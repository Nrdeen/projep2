import os from 'node:os';
import path from 'node:path';
import type { MarketplaceRepository } from '../repositories/types';
import {
  AiAttachmentError,
  AiAttachmentStore,
  inspectAiAudioMagicBytes,
} from './attachments';
import { loadAiConfig } from './config';
import { AiConversationStore } from './conversationsStore';
import { AiProviderUpstreamError, GeminiAiProvider } from './geminiProvider';
import {
  sanitizeAiOutput,
  sanitizeHistory,
  sanitizePageContext,
  validateAiInput,
} from './guardrails';
import { AiToolExecutionError, gatherMarketplaceContext } from './marketplaceTools';
import { MockAiProvider } from './mockProvider';
import { buildAiSystemInstruction } from './systemPrompt';
import type {
  AiAttachmentInlineData,
  AiAttachmentMeta,
  AiChatHistoryItem,
  AiChatResponse,
  AiConfig,
  AiConversationDetail,
  AiConversationSummary,
  AiFeedbackValue,
  AiListingCard,
  AiMarketStats,
  AiMarketplaceContext,
  AiProvider,
  AiProviderOutput,
  AiStatusResponse,
} from './types';
import { AiUsageLimiter } from './usageLimiter';

export class AiServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

function buildSuggestedFollowUps(context: AiMarketplaceContext, locale?: 'ar' | 'en'): string[] {
  const { intent, clarificationStage, listings, normalizedQuery } = context;
  const isEn = locale === 'en';

  if (
    intent === 'greeting' ||
    intent === 'casual_chat' ||
    clarificationStage === 'ask_region' ||
    clarificationStage === 'ask_budget'
  ) {
    return [];
  }

  if (context.hasAttachments) {
    return isEn
      ? [
          'Find similar offers in the market',
          'Help me draft a listing using these details',
          'What is the indicative price range for this breed?',
        ]
      : [
          'ابحث لي عن عروض مشابهة في السوق',
          'ساعدني في صياغة إعلان بناءً على هذه التفاصيل',
          'كم متوسط أسعار هذه السلالة؟',
        ];
  }

  if (intent === 'marketplace_search') {
    if (listings.length === 0) {
      return isEn
        ? [
            normalizedQuery.maxPrice ? 'Remove the price limit' : 'Show all regions',
            'Show indicative breed prices',
          ]
        : [
            normalizedQuery.maxPrice ? 'ارفع السعر وخله بدون حد' : 'اعرض كل المناطق',
            'ورني أسعار السلالات الاسترشادية',
          ];
    }
    return isEn
      ? ['Males only', 'Set max price 2500 SAR', 'Switch breed to Najdi']
      : ['أبغى ذكور فقط', 'خل السعر 2500', 'لا، قصدي نجدي'];
  }

  if (intent === 'breed_prices') {
    return isEn
      ? [
          'Find Naimi in Riyadh under 2000 SAR',
          'Show Harri offers in Taif',
          'Calculate live market stats',
        ]
      : [
          'أبي نعيمي بالرياض تحت 2000',
          'ورني عروض الحري في الطائف',
          'احسب إحصائيات السوق الحالية',
        ];
  }

  if (intent === 'marketplace_help') {
    return isEn
      ? ['Find Naimi in Riyadh under 2000 SAR', 'What are Harri and Najdi prices?']
      : ['أبي نعيمي بالرياض تحت 2000', 'كم أسعار الحري والنجدي؟'];
  }

  return [];
}

export interface AiServiceDeps {
  repo: MarketplaceRepository;
  config?: AiConfig;
  provider?: AiProvider;
  dataDir?: string;
  now?: () => number;
}

export class AiAssistantService {
  readonly config: AiConfig;
  private readonly repo: MarketplaceRepository;
  private readonly limiter: AiUsageLimiter;
  private readonly provider: AiProvider | null;
  private readonly usesGemini: boolean;
  private readonly attachmentStore: AiAttachmentStore;
  private readonly conversationStore: AiConversationStore;

  constructor(deps: AiServiceDeps) {
    this.repo = deps.repo;
    this.config = deps.config || loadAiConfig();
    const resolvedDataDir =
      deps.dataDir || path.join(os.tmpdir(), `mirbah-ai-${process.pid}`);

    this.limiter = new AiUsageLimiter({
      rateLimitPerMinute: this.config.rateLimitPerMinute,
      dailyUserQuota: this.config.dailyUserQuota,
      dailyIpQuota: this.config.dailyIpQuota,
      now: deps.now,
    });

    this.attachmentStore = new AiAttachmentStore(resolvedDataDir, {
      maxImageBytes: this.config.maxImageBytes,
      maxPdfBytes: this.config.maxPdfBytes,
      attachmentTtlMs: this.config.attachmentTtlMs,
    });
    this.conversationStore = new AiConversationStore(resolvedDataDir);

    const isProd =
      typeof this.config.isProduction === 'boolean'
        ? this.config.isProduction
        : (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

    if (deps.provider) {
      this.provider = deps.provider;
      this.usesGemini = deps.provider.name === 'gemini';
    } else if (
      this.config.geminiApiKey &&
      (this.config.providerMode === 'gemini' || this.config.providerMode === 'auto')
    ) {
      this.provider = new GeminiAiProvider(this.config, this.repo);
      this.usesGemini = true;
    } else if (
      !isProd &&
      (this.config.providerMode === 'mock' || this.config.providerMode === 'auto')
    ) {
      // MockAiProvider is strictly limited to explicit non-production dev/test environments
      this.provider = new MockAiProvider();
      this.usesGemini = false;
    } else {
      // Production without GEMINI_API_KEY (or providerMode=gemini without key) refuses mock fallback
      this.provider = null;
      this.usesGemini = false;
    }
  }

  getStatus(actorKey: string, isAuthenticated: boolean): AiStatusResponse {
    return {
      enabled: this.config.enabled,
      mode: this.usesGemini ? 'gemini' : this.provider ? 'fallback' : 'unconfigured',
      geminiConfigured: Boolean(this.config.geminiApiKey),
      model: this.config.model,
      maxMessageLength: this.config.maxMessageLength,
      usage: this.limiter.peek(actorKey, isAuthenticated),
      limits: {
        maxAttachmentsPerMessage: this.config.maxAttachmentsPerMessage,
        maxImageBytes: this.config.maxImageBytes,
        maxPdfBytes: this.config.maxPdfBytes,
        maxAudioBytes: this.config.maxAudioBytes,
      },
      features: {
        streaming: Boolean(this.provider),
        attachments: Boolean(this.provider),
        stt: Boolean(
          this.provider &&
            this.usesGemini &&
            typeof this.provider.transcribeAudio === 'function'
        ),
        tts: Boolean(
          this.provider &&
            this.usesGemini &&
            typeof this.provider.synthesizeSpeech === 'function'
        ),
      },
    };
  }

  uploadAttachment(ownerKey: string, bytes: Buffer, filename?: string): AiAttachmentMeta {
    if (!this.config.enabled) {
      throw new AiServiceError(503, 'المساعد الذكي متوقف مؤقتاً للصيانة.', 'ai_disabled');
    }
    try {
      return this.attachmentStore.saveUpload({
        ownerKey,
        bytes,
        originalName: filename,
      });
    } catch (err) {
      if (err instanceof AiAttachmentError) {
        throw new AiServiceError(err.status, err.message, err.code);
      }
      throw new AiServiceError(400, 'تعذر حفظ المرفق، حاول مرة أخرى.', 'attachment_failed');
    }
  }

  getAttachment(ownerKey: string, attachmentId: string) {
    return this.attachmentStore.getForOwner(ownerKey, attachmentId);
  }

  deleteAttachment(ownerKey: string, attachmentId: string): boolean {
    return this.attachmentStore.deleteForOwner(ownerKey, attachmentId);
  }

  listConversations(ownerKey: string, q?: string): AiConversationSummary[] {
    return this.conversationStore.list(ownerKey, q);
  }

  createConversation(ownerKey: string, title?: string): AiConversationDetail {
    return this.conversationStore.create(ownerKey, title);
  }

  getConversation(ownerKey: string, conversationId: string): AiConversationDetail | null {
    return this.conversationStore.get(ownerKey, conversationId);
  }

  renameConversation(
    ownerKey: string,
    conversationId: string,
    title: unknown
  ): AiConversationSummary | null {
    return this.conversationStore.rename(ownerKey, conversationId, title);
  }

  deleteConversation(ownerKey: string, conversationId: string): boolean {
    const res = this.conversationStore.delete(ownerKey, conversationId);
    if (!res.deleted) return false;
    if (res.attachmentIds.length > 0) {
      this.attachmentStore.deleteManyForOwner(ownerKey, res.attachmentIds);
    }
    return true;
  }

  setMessageFeedback(
    ownerKey: string,
    conversationId: string,
    messageId: string,
    feedback: AiFeedbackValue
  ): boolean {
    return this.conversationStore.setMessageFeedback(
      ownerKey,
      conversationId,
      messageId,
      feedback
    );
  }

  async transcribeAudio(params: {
    actorKey: string;
    isAuthenticated: boolean;
    bytes: Buffer;
    locale?: 'ar' | 'en';
    signal?: AbortSignal;
  }): Promise<{ text: string }> {
    if (!this.config.enabled) {
      throw new AiServiceError(503, 'المساعد الذكي متوقف مؤقتاً للصيانة.', 'ai_disabled');
    }
    if (!params.bytes || params.bytes.length === 0) {
      throw new AiServiceError(400, 'التسجيل الصوتي فارغ.', 'empty_audio');
    }
    if (params.bytes.length > this.config.maxAudioBytes) {
      throw new AiServiceError(413, 'حجم التسجيل الصوتي يتجاوز الحد المسموح.', 'audio_too_large');
    }
    const audio = inspectAiAudioMagicBytes(params.bytes);
    if (!audio) {
      throw new AiServiceError(
        400,
        'صيغة الصوت غير مدعومة.',
        'unsupported_audio_type'
      );
    }

    if (!this.provider || !this.provider.transcribeAudio) {
      throw new AiServiceError(
        503,
        'تحويل الصوت إلى نص على الخادم غير متاح حالياً، يمكنك استخدام ميزة الإملاء في المتصفح أو الكتابة مباشرة.',
        !this.provider ? 'ai_not_configured' : 'stt_unavailable'
      );
    }

    const quota = this.limiter.consume(params.actorKey, params.isAuthenticated);
    if (!quota.allowed) {
      throw new AiServiceError(
        429,
        'تجاوزت الحد المسموح مؤقتاً، حاول بعد لحظات.',
        quota.reason || 'rate_limited',
        quota.retryAfterSeconds
      );
    }

    try {
      const text = await this.provider.transcribeAudio({
        audioBuffer: params.bytes,
        mimeType: audio.mimeType,
        locale: params.locale,
        signal: params.signal,
      });
      return { text: sanitizeAiOutput(text) };
    } catch (err) {
      if (err instanceof AiProviderUpstreamError) {
        throw new AiServiceError(err.status, err.message, err.code);
      }
      throw new AiServiceError(502, 'تعذر تفريغ التسجيل الصوتي حالياً.', 'stt_failed');
    }
  }

  async synthesizeSpeech(params: {
    actorKey: string;
    isAuthenticated: boolean;
    text: unknown;
    locale?: 'ar' | 'en';
    signal?: AbortSignal;
  }): Promise<{ audioBase64: string; mimeType: string }> {
    if (!this.config.enabled) {
      throw new AiServiceError(503, 'المساعد الذكي متوقف مؤقتاً للصيانة.', 'ai_disabled');
    }
    const rawText = typeof params.text === 'string' ? params.text.trim() : '';
    if (!rawText) {
      throw new AiServiceError(400, 'لا يوجد نص للقراءة الصوتية.', 'invalid_input');
    }
    if (rawText.length > 1200) {
      throw new AiServiceError(400, 'النص طويل جداً للقراءة الصوتية.', 'message_too_long');
    }

    if (!this.provider || !this.provider.synthesizeSpeech) {
      throw new AiServiceError(
        503,
        'خدمة القراءة الصوتية عبر الخادم غير متاحة حالياً.',
        !this.provider ? 'ai_not_configured' : 'tts_unavailable'
      );
    }

    const quota = this.limiter.consume(params.actorKey, params.isAuthenticated);
    if (!quota.allowed) {
      throw new AiServiceError(
        429,
        'تجاوزت الحد المسموح مؤقتاً، حاول بعد لحظات.',
        quota.reason || 'rate_limited',
        quota.retryAfterSeconds
      );
    }

    try {
      return await this.provider.synthesizeSpeech({
        text: rawText,
        locale: params.locale,
        signal: params.signal,
      });
    } catch (err) {
      if (err instanceof AiProviderUpstreamError) {
        throw new AiServiceError(err.status, err.message, err.code);
      }
      throw new AiServiceError(502, 'تعذر توليد الصوت حالياً.', 'tts_failed');
    }
  }

  private async prepareTurn(params: {
    actorKey: string;
    ownerKey: string;
    isAuthenticated: boolean;
    message: unknown;
    history?: unknown;
    conversationId?: string | null;
    attachmentIds?: unknown;
    pageContext?: unknown;
    locale?: 'ar' | 'en';
    regenerate?: boolean;
  }) {
    if (!this.config.enabled) {
      throw new AiServiceError(
        503,
        'المساعد الذكي متوقف مؤقتاً للصيانة.',
        'ai_disabled'
      );
    }
    if (!this.provider) {
      throw new AiServiceError(
        503,
        params.locale === 'en'
          ? 'AI Assistant is unavailable because Gemini API key is not configured on the server.'
          : 'خدمة المساعد الذكي غير مفعّلة حالياً على هذا الخادم لعدم توفر مفتاح Gemini.',
        'ai_not_configured'
      );
    }

    const convId =
      typeof params.conversationId === 'string' && params.conversationId.trim()
        ? params.conversationId.trim()
        : null;

    let rawMessage = params.message;
    let attachmentIdList = Array.isArray(params.attachmentIds)
      ? params.attachmentIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    let history: AiChatHistoryItem[] = [];

    if (params.regenerate && convId) {
      const regen = this.conversationStore.prepareRegenerate(params.ownerKey, convId);
      if (!regen) {
        throw new AiServiceError(
          404,
          'لا توجد رسالة سابقة لإعادة توليدها.',
          'nothing_to_regenerate'
        );
      }
      rawMessage = regen.userMessage;
      attachmentIdList = regen.attachmentIds;
      history = sanitizeHistory(
        regen.historyBeforeLast,
        this.config.maxHistoryMessages,
        this.config.maxMessageLength
      );
    } else {
      history = sanitizeHistory(
        params.history,
        this.config.maxHistoryMessages,
        this.config.maxMessageLength
      );
      if (convId && history.length === 0) {
        const existingConv = this.conversationStore.get(params.ownerKey, convId);
        if (existingConv) {
          history = sanitizeHistory(
            existingConv.messages.map((m) => ({ role: m.role, content: m.content })),
            this.config.maxHistoryMessages,
            this.config.maxMessageLength
          );
        }
      }
    }

    let resolvedAttachments: { metas: AiAttachmentMeta[]; inlineData: AiAttachmentInlineData[] } = {
      metas: [],
      inlineData: [],
    };
    if (attachmentIdList.length > 0) {
      try {
        resolvedAttachments = this.attachmentStore.resolveManyForModel(
          params.ownerKey,
          attachmentIdList,
          this.config.maxAttachmentsPerMessage
        );
      } catch (err) {
        if (err instanceof AiAttachmentError) {
          throw new AiServiceError(err.status, err.message, err.code);
        }
        throw new AiServiceError(400, 'تعذر قراءة المرفقات.', 'attachment_failed');
      }
    }

    const hasAttachments = resolvedAttachments.metas.length > 0;
    const messageStr =
      typeof rawMessage === 'string' && !rawMessage.trim() && hasAttachments
        ? params.locale === 'en'
          ? 'Please analyze the attached file(s).'
          : 'حلّل المرفقات المرسلة.'
        : rawMessage;

    const inputCheck = validateAiInput(messageStr, this.config.maxMessageLength);
    if (!inputCheck.ok) {
      throw new AiServiceError(
        400,
        inputCheck.error || 'طلب غير صالح.',
        inputCheck.code || 'invalid_input'
      );
    }

    const quota = this.limiter.consume(params.actorKey, params.isAuthenticated);
    if (!quota.allowed) {
      const msg =
        quota.reason === 'daily_quota_exceeded'
          ? 'وصلت إلى الحد اليومي المسموح لاستخدام المساعد الذكي. يمكنك متابعة تصفح الإعلانات مباشرة أو المحاولة غداً.'
          : 'أرسلت رسائل سريعة متتالية، يرجى الانتظار قليلاً قبل إرسال رسالة جديدة.';
      throw new AiServiceError(429, msg, quota.reason || 'rate_limited', quota.retryAfterSeconds);
    }

    const pageContext = sanitizePageContext(params.pageContext);

    let context: AiMarketplaceContext;
    try {
      context = await gatherMarketplaceContext(
        this.repo,
        inputCheck.sanitizedMessage,
        history,
        { pageContext, hasAttachments }
      );
    } catch (err) {
      if (err instanceof AiToolExecutionError) {
        throw new AiServiceError(503, err.message, 'ai_tool_failure');
      }
      throw new AiServiceError(
        503,
        'تعذر الوصول إلى بيانات السوق حالياً، حاول مرة أخرى بعد قليل.',
        'ai_tool_failure'
      );
    }

    const systemInstruction = buildAiSystemInstruction(context);
    const storedUserText =
      typeof rawMessage === 'string' && rawMessage.trim()
        ? inputCheck.sanitizedMessage
        : '';

    return {
      convId,
      sanitizedMessage: inputCheck.sanitizedMessage,
      storedUserText,
      history,
      quota,
      context,
      systemInstruction,
      resolvedAttachments,
    };
  }

  private finalizeResponse(
    prepared: Awaited<ReturnType<AiAssistantService['prepareTurn']>>,
    rawOutput: AiProviderOutput
  ): AiChatResponse {
    const safeReply = sanitizeAiOutput(rawOutput.text || (rawOutput.interrupted ? 'تم إيقاف الرد.' : ''));
    const allowContextListings =
      prepared.context.intent === 'marketplace_search' &&
      prepared.context.clarificationStage === 'execute_search';

    const cards: AiListingCard[] = rawOutput.toolSearchExecuted
      ? rawOutput.cards || []
      : allowContextListings
      ? rawOutput.cards && rawOutput.cards.length > 0
        ? rawOutput.cards
        : prepared.context.listings
      : rawOutput.cards || [];

    const stats: AiMarketStats | null =
      rawOutput.stats ?? prepared.context.marketStats ?? null;
    const suggestedFollowUps = buildSuggestedFollowUps(
      prepared.context,
      prepared.context.pageContext?.locale
    );

    return {
      reply: safeReply,
      intent: prepared.context.intent,
      cards,
      ...(stats ? { stats } : {}),
      suggestedFollowUps,
      provider: rawOutput.provider,
      usage: prepared.quota.usage,
      ...(prepared.resolvedAttachments.metas.length
        ? { attachments: prepared.resolvedAttachments.metas }
        : {}),
      ...(rawOutput.interrupted ? { interrupted: true } : {}),
    };
  }

  async chat(params: {
    actorKey: string;
    ownerKey?: string;
    isAuthenticated: boolean;
    message: unknown;
    history?: unknown;
    conversationId?: string | null;
    attachmentIds?: unknown;
    pageContext?: unknown;
    locale?: 'ar' | 'en';
    regenerate?: boolean;
    persist?: boolean;
  }): Promise<AiChatResponse> {
    const ownerKey = params.ownerKey || `actor:${params.actorKey}`;
    const prepared = await this.prepareTurn({
      actorKey: params.actorKey,
      ownerKey,
      isAuthenticated: params.isAuthenticated,
      message: params.message,
      history: params.history,
      conversationId: params.conversationId,
      attachmentIds: params.attachmentIds,
      pageContext: params.pageContext,
      locale: params.locale,
      regenerate: params.regenerate,
    });

    const provider = this.provider;
    if (!provider) {
      throw new AiServiceError(
        503,
        'خدمة المساعد الذكي غير مفعّلة حالياً على هذا الخادم لعدم توفر مفتاح Gemini.',
        'ai_not_configured'
      );
    }

    let rawOutput: AiProviderOutput;
    try {
      rawOutput = await provider.generateReply({
        userMessage: prepared.sanitizedMessage,
        history: prepared.history,
        systemInstruction: prepared.systemInstruction,
        context: prepared.context,
        attachments: prepared.resolvedAttachments.inlineData,
        locale: params.locale,
      });
    } catch (err) {
      if (err instanceof AiProviderUpstreamError) {
        throw new AiServiceError(err.status, err.message, err.code);
      }
      if (err instanceof AiToolExecutionError) {
        throw new AiServiceError(503, err.message, 'ai_tool_failure');
      }
      throw new AiServiceError(
        502,
        'المساعد الذكي غير متاح مؤقتاً في هذه اللحظة. تقدر تبحث مباشرة في قائمة الإعلانات أو تحاول بعد لحظات.',
        'ai_provider_failure'
      );
    }

    const resp = this.finalizeResponse(prepared, rawOutput);
    if (params.persist !== false) {
      const saved = this.conversationStore.appendTurn({
        ownerKey,
        conversationId: prepared.convId,
        userContent: prepared.storedUserText || prepared.sanitizedMessage,
        attachments: prepared.resolvedAttachments.metas,
        assistantContent: resp.reply,
        cards: resp.cards,
        stats: resp.stats ?? null,
        suggestedFollowUps: resp.suggestedFollowUps,
        provider: resp.provider,
        interrupted: resp.interrupted,
      });
      resp.conversationId = saved.conversationId;
      resp.userMessageId = saved.userMessageId;
      resp.assistantMessageId = saved.assistantMessageId;
    }
    return resp;
  }

  async chatStream(
    params: {
      actorKey: string;
      ownerKey?: string;
      isAuthenticated: boolean;
      message: unknown;
      history?: unknown;
      conversationId?: string | null;
      attachmentIds?: unknown;
      pageContext?: unknown;
      locale?: 'ar' | 'en';
      regenerate?: boolean;
      signal?: AbortSignal;
    },
    emit: {
      onMeta: (meta: {
        cards?: AiListingCard[];
        stats?: AiMarketStats | null;
        intent?: AiChatResponse['intent'];
        attachments?: AiAttachmentMeta[];
      }) => void;
      onDelta: (chunk: string) => void;
    }
  ): Promise<AiChatResponse> {
    const ownerKey = params.ownerKey || `actor:${params.actorKey}`;
    const prepared = await this.prepareTurn({
      actorKey: params.actorKey,
      ownerKey,
      isAuthenticated: params.isAuthenticated,
      message: params.message,
      history: params.history,
      conversationId: params.conversationId,
      attachmentIds: params.attachmentIds,
      pageContext: params.pageContext,
      locale: params.locale,
      regenerate: params.regenerate,
    });

    const allowContextListings =
      prepared.context.intent === 'marketplace_search' &&
      prepared.context.clarificationStage === 'execute_search';

    emit.onMeta({
      intent: prepared.context.intent,
      ...(allowContextListings && prepared.context.listings.length > 0
        ? { cards: prepared.context.listings }
        : {}),
      ...(prepared.context.marketStats ? { stats: prepared.context.marketStats } : {}),
      ...(prepared.resolvedAttachments.metas.length
        ? { attachments: prepared.resolvedAttachments.metas }
        : {}),
    });

    const provider = this.provider;
    if (!provider) {
      throw new AiServiceError(
        503,
        'خدمة المساعد الذكي غير مفعّلة حالياً على هذا الخادم لعدم توفر مفتاح Gemini.',
        'ai_not_configured'
      );
    }

    let rawOutput: AiProviderOutput;
    try {
      if (provider.generateReplyStream) {
        rawOutput = await provider.generateReplyStream(
          {
            userMessage: prepared.sanitizedMessage,
            history: prepared.history,
            systemInstruction: prepared.systemInstruction,
            context: prepared.context,
            attachments: prepared.resolvedAttachments.inlineData,
            locale: params.locale,
            signal: params.signal,
          },
          {
            onDelta: (chunk) => emit.onDelta(chunk),
            onMeta: (meta) => emit.onMeta(meta),
          }
        );
      } else {
        rawOutput = await provider.generateReply({
          userMessage: prepared.sanitizedMessage,
          history: prepared.history,
          systemInstruction: prepared.systemInstruction,
          context: prepared.context,
          attachments: prepared.resolvedAttachments.inlineData,
          locale: params.locale,
          signal: params.signal,
        });
        if (rawOutput.text) emit.onDelta(rawOutput.text);
      }
    } catch (err) {
      if (err instanceof AiProviderUpstreamError) {
        throw new AiServiceError(err.status, err.message, err.code);
      }
      if (err instanceof AiToolExecutionError) {
        throw new AiServiceError(503, err.message, 'ai_tool_failure');
      }
      throw new AiServiceError(
        502,
        'المساعد الذكي غير متاح مؤقتاً في هذه اللحظة. تقدر تبحث مباشرة في قائمة الإعلانات أو تحاول بعد لحظات.',
        'ai_provider_failure'
      );
    }

    const resp = this.finalizeResponse(prepared, rawOutput);
    const saved = this.conversationStore.appendTurn({
      ownerKey,
      conversationId: prepared.convId,
      userContent: prepared.storedUserText || prepared.sanitizedMessage,
      attachments: prepared.resolvedAttachments.metas,
      assistantContent: resp.reply,
      cards: resp.cards,
      stats: resp.stats ?? null,
      suggestedFollowUps: resp.suggestedFollowUps,
      provider: resp.provider,
      interrupted: resp.interrupted,
    });
    resp.conversationId = saved.conversationId;
    resp.userMessageId = saved.userMessageId;
    resp.assistantMessageId = saved.assistantMessageId;
    return resp;
  }
}
