import crypto from 'node:crypto';
import express from 'express';
import { parseCookies, serializeSessionCookie } from '../auth/cookies';
import { AiAttachmentError, parseSingleFileUpload } from './attachments';
import { AiAssistantService, AiServiceError } from './service';

const GUEST_COOKIE_NAME = 'mirbah_ai_gid';

function signGuestId(gid: string, secret: string): string {
  const sig = crypto.createHmac('sha256', secret).update(gid).digest('base64url');
  return `${gid}.${sig}`;
}

function verifyGuestToken(raw: string | undefined, secret: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const gid = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^[a-f0-9-]{16,64}$/i.test(gid) || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(gid).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return gid;
}

export interface AiRouterOptions {
  guestCookieSecret?: string;
  cookieSecure?: boolean;
}

function handleAiError(err: unknown, res: express.Response, next: express.NextFunction) {
  if (err instanceof AiServiceError) {
    if (err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
    });
  }
  if (err instanceof AiAttachmentError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  next(err);
}

export function createAiRouter(
  service: AiAssistantService,
  options: AiRouterOptions = {}
): express.Router {
  const router = express.Router();
  const cookieSecret =
    options.guestCookieSecret || crypto.randomBytes(32).toString('hex');
  const cookieSecure = Boolean(options.cookieSecure);

  const resolveIdentity = (
    req: express.Request,
    res: express.Response
  ): { actorKey: string; ownerKey: string; isAuthenticated: boolean } => {
    if (req.auth?.user?.id) {
      const uid = String(req.auth.user.id);
      return {
        actorKey: uid,
        ownerKey: `usr:${uid}`,
        isAuthenticated: true,
      };
    }

    const ip = (req.ip || req.socket?.remoteAddress || 'unknown').trim() || 'unknown';
    const cookies = parseCookies(req.headers.cookie);
    let gid = verifyGuestToken(cookies[GUEST_COOKIE_NAME], cookieSecret);
    if (!gid) {
      gid = crypto.randomUUID().replace(/-/g, '');
      const signed = signGuestId(gid, cookieSecret);
      res.append(
        'Set-Cookie',
        serializeSessionCookie(GUEST_COOKIE_NAME, signed, {
          sameSite: 'Lax',
          secure: cookieSecure,
          maxAgeMs: 30 * 24 * 60 * 60 * 1000,
        })
      );
    }

    return {
      actorKey: ip,
      ownerKey: `guest:${gid}`,
      isAuthenticated: false,
    };
  };

  router.get('/status', (req, res) => {
    const { actorKey, isAuthenticated } = resolveIdentity(req, res);
    res.json(service.getStatus(actorKey, isAuthenticated));
  });

  // ---- Conversations (owner-isolated) ----
  router.get('/conversations', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ conversations: service.listConversations(ownerKey, q) });
  });

  router.post('/conversations', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
    const conversation = service.createConversation(ownerKey, title);
    res.status(201).json({ conversation });
  });

  router.get('/conversations/:id', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const conv = service.getConversation(ownerKey, String(req.params.id || ''));
    if (!conv) {
      return res.status(404).json({ error: 'المحادثة غير موجودة', code: 'not_found' });
    }
    res.json({ conversation: conv });
  });

  router.patch('/conversations/:id', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const updated = service.renameConversation(
      ownerKey,
      String(req.params.id || ''),
      req.body?.title
    );
    if (!updated) {
      return res
        .status(404)
        .json({ error: 'تعذر تحديث عنوان المحادثة', code: 'not_found' });
    }
    res.json({ conversation: updated });
  });

  router.delete('/conversations/:id', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const ok = service.deleteConversation(ownerKey, String(req.params.id || ''));
    if (!ok) {
      return res.status(404).json({ error: 'المحادثة غير موجودة', code: 'not_found' });
    }
    res.json({ ok: true });
  });

  // ---- Feedback ----
  router.post('/feedback', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const conversationId =
      typeof req.body?.conversationId === 'string' ? req.body.conversationId : '';
    const messageId = typeof req.body?.messageId === 'string' ? req.body.messageId : '';
    const rawFb = req.body?.feedback;
    const feedback = rawFb === 'up' || rawFb === 'down' ? rawFb : null;
    if (!conversationId || !messageId) {
      return res.status(400).json({ error: 'معرف المحادثة والرسالة مطلوب', code: 'invalid_input' });
    }
    const ok = service.setMessageFeedback(ownerKey, conversationId, messageId, feedback);
    if (!ok) {
      return res.status(404).json({ error: 'الرسالة غير موجودة', code: 'not_found' });
    }
    res.json({ ok: true, feedback });
  });

  // ---- Attachments (magic-byte validated & owner-isolated) ----
  router.post('/attachments', async (req, res, next) => {
    try {
      const { ownerKey } = resolveIdentity(req, res);
      const maxUploadBytes = Math.max(service.config.maxPdfBytes, service.config.maxImageBytes) + 512 * 1024;
      const parsed = await parseSingleFileUpload(req, maxUploadBytes);
      const attachment = service.uploadAttachment(ownerKey, parsed.bytes, parsed.filename);
      res.status(201).json({ attachment });
    } catch (err) {
      handleAiError(err, res, next);
    }
  });

  router.get('/attachments/:id', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const found = service.getAttachment(ownerKey, String(req.params.id || ''));
    if (!found) {
      return res.status(404).json({ error: 'المرفق غير موجود', code: 'not_found' });
    }
    res.setHeader('Content-Type', found.meta.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      found.meta.kind === 'image' ? 'inline' : 'attachment'
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(found.bytes);
  });

  router.delete('/attachments/:id', (req, res) => {
    const { ownerKey } = resolveIdentity(req, res);
    const deleted = service.deleteAttachment(ownerKey, String(req.params.id || ''));
    if (!deleted) {
      return res.status(404).json({ error: 'المرفق غير موجود', code: 'not_found' });
    }
    res.json({ ok: true });
  });

  // ---- Audio STT & TTS ----
  router.post('/transcribe', async (req, res, next) => {
    try {
      const { actorKey, isAuthenticated } = resolveIdentity(req, res);
      const maxAudioReq = service.config.maxAudioBytes + 512 * 1024;
      const parsed = await parseSingleFileUpload(req, maxAudioReq);
      const localeHeader = String(req.headers['x-ai-locale'] || req.query.locale || '').trim();
      const locale = localeHeader === 'en' ? 'en' : 'ar';
      const result = await service.transcribeAudio({
        actorKey,
        isAuthenticated,
        bytes: parsed.bytes,
        locale,
      });
      res.json(result);
    } catch (err) {
      handleAiError(err, res, next);
    }
  });

  router.post('/tts', async (req, res, next) => {
    try {
      const { actorKey, isAuthenticated } = resolveIdentity(req, res);
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const locale = (body as { locale?: unknown }).locale === 'en' ? 'en' : 'ar';
      const result = await service.synthesizeSpeech({
        actorKey,
        isAuthenticated,
        text: (body as { text?: unknown }).text,
        locale,
      });
      res.json(result);
    } catch (err) {
      handleAiError(err, res, next);
    }
  });

  // ---- Unary Chat (backwards compatible) ----
  router.post('/chat', async (req, res, next) => {
    try {
      const { actorKey, ownerKey, isAuthenticated } = resolveIdentity(req, res);
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const result = await service.chat({
        actorKey,
        ownerKey,
        isAuthenticated,
        message: body.message,
        history: body.history,
        conversationId: typeof body.conversationId === 'string' ? body.conversationId : null,
        attachmentIds: body.attachmentIds,
        pageContext: body.pageContext,
        locale: body.locale === 'en' ? 'en' : 'ar',
        regenerate: body.regenerate === true,
      });
      res.json(result);
    } catch (err) {
      handleAiError(err, res, next);
    }
  });

  // ---- SSE Streaming Chat with real-time chunks & AbortController cancellation ----
  router.post('/chat/stream', async (req, res) => {
    const { actorKey, ownerKey, isAuthenticated } = resolveIdentity(req, res);
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const abortController = new AbortController();

    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const writeSse = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const status = service.getStatus(actorKey, isAuthenticated);
    const locale = body.locale === 'en' ? 'en' : 'ar';
    if (!service.config.enabled) {
      return res.status(503).json({
        error: 'المساعد الذكي متوقف مؤقتاً للصيانة.',
        code: 'ai_disabled',
      });
    }
    if (status.mode === 'unconfigured') {
      return res.status(503).json({
        error:
          locale === 'en'
            ? 'AI Assistant is unavailable because Gemini API key is not configured on the server.'
            : 'خدمة المساعد الذكي غير مفعّلة حالياً على هذا الخادم لعدم توفر مفتاح Gemini.',
        code: 'ai_not_configured',
      });
    }

    try {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const result = await service.chatStream(
        {
          actorKey,
          ownerKey,
          isAuthenticated,
          message: body.message,
          history: body.history,
          conversationId: typeof body.conversationId === 'string' ? body.conversationId : null,
          attachmentIds: body.attachmentIds,
          pageContext: body.pageContext,
          locale: body.locale === 'en' ? 'en' : 'ar',
          regenerate: body.regenerate === true,
          signal: abortController.signal,
        },
        {
          onMeta: (meta) => writeSse('meta', meta),
          onDelta: (text) => writeSse('delta', { text }),
        }
      );

      writeSse('done', result);
      res.end();
    } catch (err) {
      if (err instanceof AiServiceError) {
        writeSse('error', {
          error: err.message,
          code: err.code,
          status: err.status,
          ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
        });
      } else {
        writeSse('error', {
          error: 'حدث خطأ غير متوقع أثناء المحادثة.',
          code: 'ai_stream_error',
          status: 500,
        });
      }
      res.end();
    }
  });

  return router;
}
