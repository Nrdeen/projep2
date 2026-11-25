import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { readBoundedBody, sanitizeOriginalName } from '../media';
import type {
  AiAttachmentInlineData,
  AiAttachmentKind,
  AiAttachmentMeta,
} from './types';

export class AiAttachmentError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AiAttachmentError';
  }
}

export interface DetectedAiDocument {
  kind: AiAttachmentKind;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  ext: 'jpg' | 'png' | 'webp' | 'pdf';
}

export interface DetectedAiAudio {
  mimeType: 'audio/webm' | 'audio/ogg' | 'audio/wav' | 'audio/mp4' | 'audio/mpeg';
  ext: 'webm' | 'ogg' | 'wav' | 'm4a' | 'mp3';
}

/**
 * Inspects strictly magic bytes — never trusts browser MIME or extension.
 */
export function inspectAiAttachmentMagicBytes(buf: Buffer): DetectedAiDocument | null {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: 'image', mimeType: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { kind: 'image', mimeType: 'image/png', ext: 'png' };
  }

  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { kind: 'image', mimeType: 'image/webp', ext: 'webp' };
  }

  // PDF: %PDF- (allow optional leading UTF-8 BOM or whitespace up to 16 bytes)
  const headAscii = buf.subarray(0, Math.min(buf.length, 32)).toString('latin1');
  if (/^(?:\xEF\xBB\xBF|\s){0,16}%PDF-1\.\d|^(?:\xEF\xBB\xBF|\s){0,16}%PDF-2\.\d/.test(headAscii)) {
    return { kind: 'pdf', mimeType: 'application/pdf', ext: 'pdf' };
  }

  return null;
}

export function inspectAiAudioMagicBytes(buf: Buffer): DetectedAiAudio | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // WebM / Matroska EBML
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mimeType: 'audio/webm', ext: 'webm' };
  }
  // Ogg / Opus
  if (buf.subarray(0, 4).toString('ascii') === 'OggS') {
    return { mimeType: 'audio/ogg', ext: 'ogg' };
  }
  // WAV: RIFF....WAVE
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return { mimeType: 'audio/wav', ext: 'wav' };
  }
  // ISO BMFF (M4A / MP4 audio)
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { mimeType: 'audio/mp4', ext: 'm4a' };
  }
  // MP3 (ID3 tag or MPEG sync frame)
  if (
    buf.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  ) {
    return { mimeType: 'audio/mpeg', ext: 'mp3' };
  }

  return null;
}

function extractBoundary(contentType: string): string | null {
  const match = /;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  return match ? match[1] || match[2] || null : null;
}

export async function parseSingleFileUpload(
  req: IncomingMessage,
  maxRequestBytes: number
): Promise<{ bytes: Buffer; filename?: string }> {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  if (contentType.startsWith('multipart/form-data')) {
    const boundary = extractBoundary(String(req.headers['content-type'] || ''));
    if (!boundary) {
      throw new AiAttachmentError(400, 'تنسيق رفع الملف غير صالح', 'invalid_upload');
    }
    const raw = await readBoundedBody(req, maxRequestBytes);
    const boundaryMarker = Buffer.from(`--${boundary}`);
    const headerSep = Buffer.from('\r\n\r\n');
    let offset = raw.indexOf(boundaryMarker);
    if (offset === -1) {
      throw new AiAttachmentError(400, 'تنسيق رفع الملف غير صالح', 'invalid_upload');
    }

    let fileBytes: Buffer | null = null;
    let filename: string | undefined;

    while (offset !== -1) {
      const partStart = offset + boundaryMarker.length;
      if (raw.subarray(partStart, partStart + 2).equals(Buffer.from('--'))) break;
      const contentStart =
        raw[partStart] === 0x0d && raw[partStart + 1] === 0x0a ? partStart + 2 : partStart;
      const nextBoundary = raw.indexOf(boundaryMarker, contentStart);
      if (nextBoundary === -1) break;
      const headerEnd = raw.indexOf(headerSep, contentStart);
      if (headerEnd === -1 || headerEnd > nextBoundary) {
        offset = nextBoundary;
        continue;
      }
      const headerText = raw.subarray(contentStart, headerEnd).toString('utf-8');
      let dataEnd = nextBoundary;
      if (dataEnd >= 2 && raw[dataEnd - 2] === 0x0d && raw[dataEnd - 1] === 0x0a) {
        dataEnd -= 2;
      }
      const partBody = raw.subarray(headerEnd + headerSep.length, dataEnd);
      const dispMatch = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText);
      const disp = dispMatch?.[1] || '';
      const fileMatch = /\bfilename="([^"]*)"/i.exec(disp);
      if (fileMatch && !fileBytes) {
        fileBytes = partBody;
        filename = fileMatch[1];
      }
      offset = nextBoundary;
    }

    if (!fileBytes) {
      throw new AiAttachmentError(400, 'لم يتم إرفاق أي ملف للرفع', 'missing_file');
    }
    return { bytes: fileBytes, filename };
  }

  if (
    contentType.startsWith('image/') ||
    contentType.startsWith('application/pdf') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('application/octet-stream')
  ) {
    const bytes = await readBoundedBody(req, maxRequestBytes);
    const rawName = req.headers['x-file-name'];
    const filename =
      typeof rawName === 'string'
        ? (() => {
            try {
              return decodeURIComponent(rawName);
            } catch {
              return rawName;
            }
          })()
        : undefined;
    return { bytes, filename };
  }

  throw new AiAttachmentError(415, 'صيغة الطلب غير مدعومة لرفع المرفق', 'unsupported_media_type');
}

interface StoredAttachmentRecord {
  meta: AiAttachmentMeta;
  ownerKey: string;
  filenameOnDisk: string;
  expiresAtMs: number;
  pinnedToConversation: boolean;
}

export class AiAttachmentStore {
  private readonly dir: string;
  private readonly indexPath: string;
  private readonly records = new Map<string, StoredAttachmentRecord>();
  private readonly maxPerOwner = 24;

  constructor(
    dataDir: string,
    private readonly limits: {
      maxImageBytes: number;
      maxPdfBytes: number;
      attachmentTtlMs: number;
    }
  ) {
    this.dir = path.join(dataDir, 'ai-attachments');
    this.indexPath = path.join(this.dir, 'index.json');
    this.loadIndex();
    this.cleanupExpired();
  }

  private loadIndex() {
    if (!fs.existsSync(this.indexPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item && typeof item.meta?.id === 'string' && typeof item.ownerKey === 'string') {
            this.records.set(item.meta.id, item as StoredAttachmentRecord);
          }
        }
      }
    } catch {
      // Ignore corrupt attachment index; fresh store
    }
  }

  private saveIndex() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.indexPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.records.values()], null, 2), 'utf8');
    fs.renameSync(tmp, this.indexPath);
  }

  private filePathFor(filenameOnDisk: string): string {
    if (!/^aia_[a-f0-9]+\.(jpg|png|webp|pdf)$/i.test(filenameOnDisk)) {
      throw new AiAttachmentError(400, 'معرف المرفق غير صالح', 'invalid_attachment_id');
    }
    const base = path.resolve(this.dir);
    const resolved = path.resolve(base, filenameOnDisk);
    if (!resolved.startsWith(base + path.sep)) {
      throw new AiAttachmentError(400, 'مسار المرفق غير صالح', 'invalid_attachment_path');
    }
    return resolved;
  }

  saveUpload(params: {
    ownerKey: string;
    bytes: Buffer;
    originalName?: string;
    nowMs?: number;
  }): AiAttachmentMeta {
    const nowMs = params.nowMs ?? Date.now();
    this.cleanupExpired(nowMs);

    if (!params.bytes || params.bytes.length === 0) {
      throw new AiAttachmentError(400, 'الملف المرفوع فارغ', 'empty_file');
    }

    const detected = inspectAiAttachmentMagicBytes(params.bytes);
    if (!detected) {
      throw new AiAttachmentError(
        400,
        'نوع الملف غير مدعوم. المسموح فقط: صور (JPG, PNG, WebP) أو مستند PDF.',
        'unsupported_file_type'
      );
    }

    if (detected.kind === 'image' && params.bytes.length > this.limits.maxImageBytes) {
      throw new AiAttachmentError(
        413,
        `حجم الصورة يتجاوز الحد المسموح (${Math.round(this.limits.maxImageBytes / (1024 * 1024))} ميجابايت)`,
        'file_too_large'
      );
    }
    if (detected.kind === 'pdf' && params.bytes.length > this.limits.maxPdfBytes) {
      throw new AiAttachmentError(
        413,
        `حجم ملف PDF يتجاوز الحد المسموح (${Math.round(this.limits.maxPdfBytes / (1024 * 1024))} ميجابايت)`,
        'file_too_large'
      );
    }

    // Cap unpinned pending uploads per owner to protect disk
    let ownerUnpinned = 0;
    for (const r of this.records.values()) {
      if (r.ownerKey === params.ownerKey && !r.pinnedToConversation) {
        ownerUnpinned += 1;
      }
    }
    if (ownerUnpinned >= this.maxPerOwner) {
      throw new AiAttachmentError(
        429,
        'لديك عدد كبير من المرفقات المؤقتة، أرسل رسالتك أو احذف بعض المرفقات أولاً.',
        'too_many_pending_attachments'
      );
    }

    const id = `aia_${crypto.randomUUID().replace(/-/g, '')}`;
    const filenameOnDisk = `${id}.${detected.ext}`;
    const filePath = this.filePathFor(filenameOnDisk);

    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(filePath, params.bytes);

    const meta: AiAttachmentMeta = {
      id,
      kind: detected.kind,
      mimeType: detected.mimeType,
      name: sanitizeOriginalName(params.originalName, detected.ext),
      sizeBytes: params.bytes.length,
      url: `/api/v1/ai/attachments/${id}`,
      createdAt: new Date(nowMs).toISOString(),
    };

    this.records.set(id, {
      meta,
      ownerKey: params.ownerKey,
      filenameOnDisk,
      expiresAtMs: nowMs + this.limits.attachmentTtlMs,
      pinnedToConversation: false,
    });
    this.saveIndex();
    return meta;
  }

  getForOwner(
    ownerKey: string,
    attachmentId: string
  ): { meta: AiAttachmentMeta; bytes: Buffer } | null {
    const id = String(attachmentId || '').trim();
    const rec = this.records.get(id);
    if (!rec || rec.ownerKey !== ownerKey) return null;
    try {
      const bytes = fs.readFileSync(this.filePathFor(rec.filenameOnDisk));
      return { meta: rec.meta, bytes };
    } catch {
      return null;
    }
  }

  resolveManyForModel(
    ownerKey: string,
    attachmentIds: string[],
    maxCount: number
  ): { metas: AiAttachmentMeta[]; inlineData: AiAttachmentInlineData[] } {
    if (!attachmentIds.length) return { metas: [], inlineData: [] };
    if (attachmentIds.length > maxCount) {
      throw new AiAttachmentError(
        400,
        `الحد الأقصى للمرفقات في الرسالة الواحدة هو ${maxCount}.`,
        'too_many_attachments'
      );
    }

    const metas: AiAttachmentMeta[] = [];
    const inlineData: AiAttachmentInlineData[] = [];
    let modified = false;

    for (const rawId of attachmentIds) {
      const id = String(rawId || '').trim();
      if (!id) continue;
      const rec = this.records.get(id);
      if (!rec || rec.ownerKey !== ownerKey) {
        throw new AiAttachmentError(
          404,
          'أحد المرفقات غير موجود أو انتهت صلاحيته.',
          'attachment_not_found'
        );
      }
      let bytes: Buffer;
      try {
        bytes = fs.readFileSync(this.filePathFor(rec.filenameOnDisk));
      } catch {
        throw new AiAttachmentError(
          404,
          'تعذر قراءة ملف المرفق، أعد رفعه من فضلك.',
          'attachment_not_found'
        );
      }
      rec.pinnedToConversation = true;
      // Extend retention for attachments used inside persisted conversations
      rec.expiresAtMs = Math.max(rec.expiresAtMs, Date.now() + 7 * 24 * 60 * 60 * 1000);
      modified = true;

      metas.push(rec.meta);
      inlineData.push({
        id: rec.meta.id,
        kind: rec.meta.kind,
        mimeType: rec.meta.mimeType,
        name: rec.meta.name,
        sizeBytes: rec.meta.sizeBytes,
        base64Data: bytes.toString('base64'),
      });
    }

    if (modified) this.saveIndex();
    return { metas, inlineData };
  }

  deleteForOwner(ownerKey: string, attachmentId: string): boolean {
    const id = String(attachmentId || '').trim();
    const rec = this.records.get(id);
    if (!rec || rec.ownerKey !== ownerKey) return false;
    this.removeRecord(id, rec);
    this.saveIndex();
    return true;
  }

  deleteManyForOwner(ownerKey: string, ids: string[]): void {
    let changed = false;
    for (const id of ids) {
      const rec = this.records.get(id);
      if (rec && rec.ownerKey === ownerKey) {
        this.removeRecord(id, rec);
        changed = true;
      }
    }
    if (changed) this.saveIndex();
  }

  cleanupExpired(nowMs = Date.now()): number {
    let removed = 0;
    for (const [id, rec] of this.records.entries()) {
      if (rec.expiresAtMs <= nowMs) {
        this.removeRecord(id, rec);
        removed += 1;
      }
    }
    if (removed > 0) this.saveIndex();
    return removed;
  }

  private removeRecord(id: string, rec: StoredAttachmentRecord) {
    this.records.delete(id);
    try {
      const fp = this.filePathFor(rec.filenameOnDisk);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {
      // ignore fs cleanup error
    }
  }
}
