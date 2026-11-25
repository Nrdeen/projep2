import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AiAttachmentMeta,
  AiConversationDetail,
  AiConversationSummary,
  AiFeedbackValue,
  AiListingCard,
  AiMarketStats,
  AiProviderName,
  AiStoredMessage,
} from './types';

interface StoredConversationRecord extends AiConversationDetail {
  ownerKey: string;
}

const MAX_CONVERSATIONS_PER_OWNER = 60;
const MAX_MESSAGES_PER_CONVERSATION = 100;

function sanitizeTitle(raw: unknown, fallback = 'محادثة جديدة'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 80);
}

function buildAutoTitle(firstPrompt: string, attachments?: AiAttachmentMeta[]): string {
  const cleaned = firstPrompt.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned) {
    return cleaned.length > 48 ? `${cleaned.slice(0, 48).trim()}…` : cleaned;
  }
  if (attachments && attachments.length > 0) {
    return attachments[0].name.slice(0, 48);
  }
  return 'محادثة جديدة';
}

export class AiConversationStore {
  private readonly filePath: string;
  private readonly conversations = new Map<string, StoredConversationRecord>();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'ai-conversations.json');
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.id === 'string' && typeof item.ownerKey === 'string') {
            this.conversations.set(item.id, item as StoredConversationRecord);
          }
        }
      }
    } catch {
      // Ignore corrupt history file; start fresh
    }
  }

  private save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.conversations.values()], null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  private toSummary(rec: StoredConversationRecord): AiConversationSummary {
    const last = rec.messages[rec.messages.length - 1];
    const previewRaw = last?.content || (last?.attachments?.[0]?.name ?? '');
    const preview =
      previewRaw.length > 72 ? `${previewRaw.slice(0, 72).trim()}…` : previewRaw;
    return {
      id: rec.id,
      title: rec.title,
      messageCount: rec.messages.length,
      lastMessagePreview: preview,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    };
  }

  private toDetail(rec: StoredConversationRecord): AiConversationDetail {
    return {
      id: rec.id,
      title: rec.title,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      messages: rec.messages.map((m) => ({ ...m })),
    };
  }

  list(ownerKey: string, query?: string): AiConversationSummary[] {
    const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
    const owned: StoredConversationRecord[] = [];
    for (const rec of this.conversations.values()) {
      if (rec.ownerKey !== ownerKey) continue;
      if (q) {
        const titleMatch = rec.title.toLowerCase().includes(q);
        const msgMatch = rec.messages.some((m) => m.content.toLowerCase().includes(q));
        if (!titleMatch && !msgMatch) continue;
      }
      owned.push(rec);
    }
    owned.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return owned.map((r) => this.toSummary(r));
  }

  get(ownerKey: string, conversationId: string): AiConversationDetail | null {
    const rec = this.conversations.get(String(conversationId || '').trim());
    if (!rec || rec.ownerKey !== ownerKey) return null;
    return this.toDetail(rec);
  }

  create(ownerKey: string, title?: string): AiConversationDetail {
    const nowIso = new Date().toISOString();
    const rec: StoredConversationRecord = {
      id: `conv_${crypto.randomUUID().replace(/-/g, '')}`,
      ownerKey,
      title: sanitizeTitle(title),
      createdAt: nowIso,
      updatedAt: nowIso,
      messages: [],
    };
    this.conversations.set(rec.id, rec);
    this.enforceOwnerCap(ownerKey);
    this.save();
    return this.toDetail(rec);
  }

  rename(ownerKey: string, conversationId: string, title: unknown): AiConversationSummary | null {
    const rec = this.conversations.get(String(conversationId || '').trim());
    if (!rec || rec.ownerKey !== ownerKey) return null;
    const nextTitle = sanitizeTitle(title, '');
    if (!nextTitle) return null;
    rec.title = nextTitle;
    rec.updatedAt = new Date().toISOString();
    this.save();
    return this.toSummary(rec);
  }

  delete(ownerKey: string, conversationId: string): { deleted: boolean; attachmentIds: string[] } {
    const id = String(conversationId || '').trim();
    const rec = this.conversations.get(id);
    if (!rec || rec.ownerKey !== ownerKey) {
      return { deleted: false, attachmentIds: [] };
    }
    const attachmentIds: string[] = [];
    for (const m of rec.messages) {
      for (const att of m.attachments || []) {
        attachmentIds.push(att.id);
      }
    }
    this.conversations.delete(id);
    this.save();
    return { deleted: true, attachmentIds };
  }

  prepareRegenerate(
    ownerKey: string,
    conversationId: string
  ): {
    userMessage: string;
    attachmentIds: string[];
    historyBeforeLast: Array<{ role: 'user' | 'assistant'; content: string }>;
  } | null {
    const rec = this.conversations.get(String(conversationId || '').trim());
    if (!rec || rec.ownerKey !== ownerKey || rec.messages.length === 0) return null;

    // Work backwards to find the last user prompt
    let idx = rec.messages.length - 1;
    while (idx >= 0 && rec.messages[idx].role === 'assistant') {
      idx -= 1;
    }
    if (idx < 0) return null;
    const lastUser = rec.messages[idx];
    // Trim from lastUser onwards so appendTurn re-records cleanly without duplicating
    const trimmed = rec.messages.slice(0, idx);
    rec.messages = trimmed;
    rec.updatedAt = new Date().toISOString();
    this.save();

    return {
      userMessage: lastUser.content,
      attachmentIds: (lastUser.attachments || []).map((a) => a.id),
      historyBeforeLast: trimmed.map((m) => ({ role: m.role, content: m.content })),
    };
  }

  appendTurn(params: {
    ownerKey: string;
    conversationId?: string | null;
    userContent: string;
    attachments?: AiAttachmentMeta[];
    assistantContent: string;
    cards?: AiListingCard[];
    stats?: AiMarketStats | null;
    suggestedFollowUps?: string[];
    provider: AiProviderName;
    interrupted?: boolean;
  }): {
    conversationId: string;
    userMessageId: string;
    assistantMessageId: string;
  } {
    const nowMs = Date.now();
    const userNowIso = new Date(nowMs).toISOString();
    const aiNowIso = new Date(nowMs + 1).toISOString();

    let rec: StoredConversationRecord | undefined;
    if (params.conversationId) {
      const found = this.conversations.get(String(params.conversationId).trim());
      if (found && found.ownerKey === params.ownerKey) {
        rec = found;
      }
    }

    if (!rec) {
      rec = {
        id: `conv_${crypto.randomUUID().replace(/-/g, '')}`,
        ownerKey: params.ownerKey,
        title: buildAutoTitle(params.userContent, params.attachments),
        createdAt: userNowIso,
        updatedAt: aiNowIso,
        messages: [],
      };
      this.conversations.set(rec.id, rec);
      this.enforceOwnerCap(params.ownerKey);
    } else if (rec.messages.length === 0 && (rec.title === 'محادثة جديدة' || rec.title === 'New conversation')) {
      rec.title = buildAutoTitle(params.userContent, params.attachments);
    }

    const userMsg: AiStoredMessage = {
      id: `msg_u_${crypto.randomUUID().slice(0, 12)}`,
      role: 'user',
      content: params.userContent,
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
      createdAt: userNowIso,
    };

    const aiMsg: AiStoredMessage = {
      id: `msg_a_${crypto.randomUUID().slice(0, 12)}`,
      role: 'assistant',
      content: params.assistantContent,
      ...(params.cards?.length ? { cards: params.cards } : {}),
      ...(params.stats ? { stats: params.stats } : {}),
      ...(params.suggestedFollowUps?.length ? { suggestedFollowUps: params.suggestedFollowUps } : {}),
      provider: params.provider,
      feedback: null,
      ...(params.interrupted ? { interrupted: true } : {}),
      createdAt: aiNowIso,
    };

    rec.messages.push(userMsg, aiMsg);
    if (rec.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
      rec.messages = rec.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
    }
    rec.updatedAt = aiNowIso;
    this.save();

    return {
      conversationId: rec.id,
      userMessageId: userMsg.id,
      assistantMessageId: aiMsg.id,
    };
  }

  setMessageFeedback(
    ownerKey: string,
    conversationId: string,
    messageId: string,
    feedback: AiFeedbackValue
  ): boolean {
    const rec = this.conversations.get(String(conversationId || '').trim());
    if (!rec || rec.ownerKey !== ownerKey) return false;
    const msg = rec.messages.find((m) => m.id === messageId && m.role === 'assistant');
    if (!msg) return false;
    msg.feedback = feedback;
    rec.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  private enforceOwnerCap(ownerKey: string) {
    const owned = [...this.conversations.values()]
      .filter((r) => r.ownerKey === ownerKey)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    if (owned.length <= MAX_CONVERSATIONS_PER_OWNER) return;
    for (const old of owned.slice(MAX_CONVERSATIONS_PER_OWNER)) {
      this.conversations.delete(old.id);
    }
  }
}
