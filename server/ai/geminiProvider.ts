import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { MarketplaceRepository } from '../repositories/types';
import { DEFAULT_AI_MODEL, DEFAULT_STT_MODEL, DEFAULT_TTS_MODEL } from './config';
import {
  AiToolExecutionError,
  executeCompareListingsOrBreedsTool,
  executeGetBreedPriceGuidesTool,
  executeGetMarketStatsTool,
  executeSearchPublishedListingsTool,
} from './marketplaceTools';
import type {
  AiConfig,
  AiListingCard,
  AiMarketStats,
  AiProvider,
  AiProviderInput,
  AiProviderOutput,
  AiStreamCallbacks,
} from './types';

const SECONDARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';

export class AiProviderUpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AiProviderUpstreamError';
  }
}

const searchPublishedListingsDeclaration: FunctionDeclaration = {
  name: 'searchPublishedListings',
  description:
    'Search currently published Saudi livestock marketplace listings with optional breed, region, city, price range, sex, vaccination, and sorting filters. Also call after visually inspecting a livestock photo to find similar marketplace offers.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Free-text Saudi dialect search hint (e.g., جذعان نعيمي، هرفي حري، عوارض دفيع).',
      },
      breed: {
        type: Type.STRING,
        description: 'Saudi livestock breed name (e.g., نعيمي، نجدي، حري، عارضي، سواكني).',
      },
      region: {
        type: Type.STRING,
        description: 'Saudi region name (e.g., الرياض، مكة المكرمة، القصيم، المنطقة الشرقية).',
      },
      city: {
        type: Type.STRING,
        description: 'City name (e.g., الرياض، المزاحمية، بريدة، الطائف، جدة).',
      },
      minPrice: {
        type: Type.NUMBER,
        description: 'Minimum price in SAR.',
      },
      maxPrice: {
        type: Type.NUMBER,
        description: 'Maximum price in SAR.',
      },
      sex: {
        type: Type.STRING,
        description: 'Optional livestock sex filter: ذكر, أنثى, or قطيع مختلط.',
      },
      vaccinatedOnly: {
        type: Type.BOOLEAN,
        description: 'Set true to return only vaccinated livestock listings.',
      },
      negotiableOnly: {
        type: Type.BOOLEAN,
        description: 'Set true to return only negotiable listings.',
      },
      sort: {
        type: Type.STRING,
        description: 'Sort order: newest, price_asc, price_desc, or most_liked.',
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum number of listings to return (1 to 4).',
      },
    },
  },
};

const getBreedPriceGuidesDeclaration: FunctionDeclaration = {
  name: 'getBreedPriceGuides',
  description:
    'Get indicative Saudi market price guides, average weights, and breed details for one or more Saudi livestock breeds.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      breed: {
        type: Type.STRING,
        description: 'Optional breed name to filter guides (e.g., نعيمي، حري، نجدي، عارضي، سواكني).',
      },
      breeds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Optional list of breed names to retrieve and compare guides together.',
      },
    },
  },
};

const getMarketStatsDeclaration: FunctionDeclaration = {
  name: 'getMarketStats',
  description:
    'Calculate real marketplace statistics (count, min, max, average, and median price in SAR) strictly from currently published listings.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      breed: {
        type: Type.STRING,
        description: 'Optional breed filter.',
      },
      region: {
        type: Type.STRING,
        description: 'Optional region filter.',
      },
    },
  },
};

const compareListingsOrBreedsDeclaration: FunctionDeclaration = {
  name: 'compareListingsOrBreeds',
  description:
    'Compare published marketplace listings (by IDs or one/multiple breeds) alongside indicative breed guides.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      listingIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Optional list of published listing IDs to compare.',
      },
      breed: {
        type: Type.STRING,
        description: 'Optional single breed name to compare.',
      },
      breeds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Optional multiple breed names to compare side-by-side (e.g., ["نعيمي", "حري", "نجدي"]).',
      },
    },
  },
};

function isRetryableUpstreamError(err: unknown): boolean {
  const status = Number((err as any)?.status || (err as any)?.statusCode || 0);
  const msg = String((err as any)?.message || '');
  if (/AbortError|aborted|timeout|cancelled/i.test(msg)) return false;
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 429) {
    return false;
  }
  return (
    status >= 500 ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|unavailable|high demand|overloaded/i.test(msg)
  );
}

function isModelFallbackError(err: unknown): boolean {
  const status = Number((err as any)?.status || (err as any)?.statusCode || 0);
  const msg = String((err as any)?.message || '');
  if (/AbortError|aborted|cancelled/i.test(msg)) return false;
  if (status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) {
    return true;
  }
  return isRetryableUpstreamError(err);
}

function mapGeminiError(err: unknown): AiProviderUpstreamError {
  if (err instanceof AiProviderUpstreamError) return err;
  if (err instanceof AiToolExecutionError) {
    return new AiProviderUpstreamError(503, err.message, 'ai_tool_failure');
  }

  const status = Number((err as any)?.status || (err as any)?.statusCode || 502);
  const msg = String((err as any)?.message || '');

  if (/aborted|AbortError|cancelled/i.test(msg) || (err as any)?.name === 'AbortError') {
    return new AiProviderUpstreamError(499, 'تم إيقاف التوليد.', 'ai_aborted');
  }

  console.warn('[ai:gemini] Upstream request failed', {
    status,
    name: (err as any)?.name || 'Error',
    message: msg.slice(0, 220),
  });

  if (status === 404 || /NOT_FOUND/i.test(msg)) {
    return new AiProviderUpstreamError(
      502,
      'معرف نموذج المساعد الذكي المحدد غير متاح حالياً، يرجى مراجعة إعدادات النموذج.',
      'ai_model_not_found'
    );
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    return new AiProviderUpstreamError(
      503,
      'المساعد الذكي غير متاح مؤقتاً في هذه اللحظة. تقدر تبحث مباشرة في قائمة الإعلانات أو تحاول بعد لحظات.',
      'ai_auth_error'
    );
  }
  if (status === 400 || /INVALID_ARGUMENT/i.test(msg)) {
    return new AiProviderUpstreamError(
      400,
      'تعذر معالجة الملف أو الطلب المرفق. تأكد أن الصورة أو ملف PDF سليم وغير تالف ثم حاول مرة أخرى.',
      'ai_invalid_request'
    );
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) {
    return new AiProviderUpstreamError(
      429,
      'الخدمة مزدحمة الآن بشكل مؤقت، جرب مرة ثانية بعد ثوانٍ قليلة.',
      'ai_upstream_rate_limited'
    );
  }
  if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(msg)) {
    return new AiProviderUpstreamError(
      503,
      'الخدمة تشهد ضغطاً مؤقتاً حالياً، يمكنك إعادة المحاولة بعد لحظات.',
      'ai_upstream_busy'
    );
  }
  if (/timeout/i.test(msg)) {
    return new AiProviderUpstreamError(
      504,
      'تأخر الرد قليلاً عن المعتاد. تقدر تعيد المحاولة الآن أو تستخدم البحث المباشر في السوق.',
      'ai_timeout'
    );
  }
  return new AiProviderUpstreamError(
    502,
    'المساعد الذكي غير متاح مؤقتاً في هذه اللحظة. تقدر تبحث مباشرة في قائمة الإعلانات أو تحاول بعد لحظات.',
    'ai_upstream_error'
  );
}

function buildUserParts(input: AiProviderInput): any[] {
  const parts: any[] = [];
  if (input.attachments && input.attachments.length > 0) {
    for (const att of input.attachments) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.base64Data,
        },
      });
    }
  }
  parts.push({
    text:
      input.userMessage ||
      (input.locale === 'en'
        ? 'Analyze the attached file(s).'
        : 'حلّل المرفقات التالية بدقة.'),
  });
  return parts;
}

export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini' as const;
  private readonly client: GoogleGenAI;
  private readonly hasClientOverride: boolean;

  constructor(
    private readonly config: AiConfig,
    private readonly repo?: MarketplaceRepository,
    clientOverride?: GoogleGenAI
  ) {
    if (!clientOverride && !config.geminiApiKey) {
      throw new Error('GeminiAiProvider requires a configured GEMINI_API_KEY.');
    }
    this.hasClientOverride = Boolean(clientOverride);
    this.client =
      clientOverride ||
      new GoogleGenAI({
        apiKey: config.geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
  }

  private buildModelConfig(
    modelName: string,
    systemInstruction: string,
    tools: any[] | undefined,
    signal?: AbortSignal
  ) {
    const supportsGemini4Thinking = modelName.startsWith('gemini-4');
    return {
      systemInstruction,
      ...(supportsGemini4Thinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      ...(tools ? { tools } : {}),
      ...(signal ? { abortSignal: signal } : {}),
    };
  }

  private getModelCandidates(preferredModel?: string): string[] {
    if (preferredModel && preferredModel !== DEFAULT_AI_MODEL) {
      return [preferredModel];
    }
    if (!this.hasClientOverride && this.config.model === DEFAULT_AI_MODEL) {
      return [this.config.model, SECONDARY_GEMINI_MODEL];
    }
    return [preferredModel || this.config.model];
  }

  private async runWithDeadline<T>(
    promise: Promise<T>,
    deadlineMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error('Gemini request timeout');
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Gemini request timeout')), remainingMs);
          timer.unref?.();
          if (signal) {
            abortHandler = () => reject(new DOMException('Aborted', 'AbortError'));
            signal.addEventListener('abort', abortHandler, { once: true });
          }
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
    }
  }

  private async callModelWithRetry(
    contents: any[],
    systemInstruction: string,
    tools: any[] | undefined,
    deadlineMs: number,
    signal?: AbortSignal,
    preferredModel?: string
  ) {
    const candidates = this.getModelCandidates(preferredModel);
    let lastErr: unknown;

    for (let idx = 0; idx < candidates.length; idx += 1) {
      const modelName = candidates[idx];
      const executeOnce = () =>
        this.runWithDeadline(
          this.client.models.generateContent({
            model: modelName,
            contents,
            config: this.buildModelConfig(modelName, systemInstruction, tools, signal),
          }),
          deadlineMs,
          signal
        );

      try {
        return { modelUsed: modelName, response: await executeOnce() };
      } catch (firstErr) {
        lastErr = firstErr;
        const remainingMs = deadlineMs - Date.now();
        if (signal?.aborted) {
          throw firstErr;
        }
        if (
          !isRetryableUpstreamError(firstErr) ||
          remainingMs < Math.min(2000, this.config.timeoutMs * 0.35)
        ) {
          if (
            idx + 1 < candidates.length &&
            isModelFallbackError(firstErr) &&
            remainingMs >= 2500
          ) {
            continue;
          }
          throw firstErr;
        }
        await new Promise((r) => setTimeout(r, 300));
        try {
          return { modelUsed: modelName, response: await executeOnce() };
        } catch (secondErr) {
          lastErr = secondErr;
          const canTrySecondary =
            idx + 1 < candidates.length &&
            !signal?.aborted &&
            isModelFallbackError(secondErr) &&
            deadlineMs - Date.now() >= 2500;
          if (!canTrySecondary) {
            throw secondErr;
          }
        }
      }
    }

    throw lastErr;
  }

  private resolveToolsForTurn(input: AiProviderInput): any[] | undefined {
    const hasAttachments = Boolean(input.attachments && input.attachments.length > 0);
    const allowToolsForTurn =
      Boolean(this.repo) &&
      (hasAttachments ||
        (input.context?.intent !== 'greeting' &&
          input.context?.intent !== 'casual_chat' &&
          input.context?.clarificationStage !== 'ask_region' &&
          input.context?.clarificationStage !== 'ask_budget'));

    return allowToolsForTurn
      ? [
          {
            functionDeclarations: [
              searchPublishedListingsDeclaration,
              getBreedPriceGuidesDeclaration,
              getMarketStatsDeclaration,
              compareListingsOrBreedsDeclaration,
            ],
          },
        ]
      : undefined;
  }

  private async executeFunctionCalls(
    functionCalls: any[],
    state: {
      collectedCards: AiListingCard[];
      collectedStats: AiMarketStats | null;
      toolSearchExecuted: boolean;
      toolSearchFailed: boolean;
    }
  ): Promise<any[]> {
    const responseParts: any[] = [];
    for (const call of functionCalls) {
      const callArgs = (call.args && typeof call.args === 'object' ? call.args : {}) as Record<
        string,
        unknown
      >;

      if (call.name === 'searchPublishedListings' && this.repo) {
        state.toolSearchExecuted = true;
        try {
          const searchRes = await executeSearchPublishedListingsTool(this.repo, callArgs);
          state.collectedCards.splice(0, state.collectedCards.length, ...searchRes.cards);
          state.toolSearchFailed = false;
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                totalMatchingListings: searchRes.totalMatchingListings,
                listings: searchRes.listingsSummary,
              },
            },
          });
        } catch (toolErr) {
          state.toolSearchFailed = true;
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error:
                  toolErr instanceof Error ? toolErr.message : 'Listing search tool unavailable',
              },
            },
          });
        }
      } else if (call.name === 'getBreedPriceGuides' && this.repo) {
        try {
          const guidesRes = await executeGetBreedPriceGuidesTool(this.repo, callArgs);
          responseParts.push({
            functionResponse: { id: call.id, name: call.name, response: guidesRes },
          });
        } catch (toolErr) {
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error: toolErr instanceof Error ? toolErr.message : 'Breed guides lookup failed',
              },
            },
          });
        }
      } else if (call.name === 'getMarketStats' && this.repo) {
        try {
          const statsRes = await executeGetMarketStatsTool(this.repo, callArgs);
          if (statsRes.stats.count > 0) {
            state.collectedStats = statsRes.stats;
          }
          responseParts.push({
            functionResponse: { id: call.id, name: call.name, response: statsRes },
          });
        } catch (toolErr) {
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error: toolErr instanceof Error ? toolErr.message : 'Market stats failed',
              },
            },
          });
        }
      } else if (call.name === 'compareListingsOrBreeds' && this.repo) {
        state.toolSearchExecuted = true;
        try {
          const cmpRes = await executeCompareListingsOrBreedsTool(this.repo, callArgs);
          if (cmpRes.cards.length > 0) {
            state.collectedCards.splice(0, state.collectedCards.length, ...cmpRes.cards);
          }
          responseParts.push({
            functionResponse: { id: call.id, name: call.name, response: cmpRes },
          });
        } catch (toolErr) {
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error: toolErr instanceof Error ? toolErr.message : 'Comparison failed',
              },
            },
          });
        }
      } else {
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: { error: 'Unsupported tool' },
          },
        });
      }
    }

    if (state.toolSearchFailed && state.collectedCards.length === 0) {
      throw new AiProviderUpstreamError(
        503,
        'تعذر البحث في الإعلانات حالياً بسبب خلل مؤقت في جلب البيانات، حاول مرة أخرى بعد قليل.',
        'ai_tool_failure'
      );
    }

    return responseParts;
  }

  async generateReply(input: AiProviderInput): Promise<AiProviderOutput> {
    const contents: any[] = [
      ...input.history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: buildUserParts(input) },
    ];

    const tools = this.resolveToolsForTurn(input);
    const deadlineMs = Date.now() + this.config.timeoutMs;
    const state = {
      collectedCards: [] as AiListingCard[],
      collectedStats: input.context.marketStats ?? null,
      toolSearchExecuted: false,
      toolSearchFailed: false,
    };

    try {
      let { modelUsed, response } = await this.callModelWithRetry(
        contents,
        input.systemInstruction,
        tools,
        deadlineMs,
        input.signal
      );

      for (let round = 0; round < 2; round += 1) {
        const functionCalls = response.functionCalls;
        const previousContent = response.candidates?.[0]?.content;
        if (!functionCalls || functionCalls.length === 0 || !previousContent || !this.repo) {
          break;
        }
        const responseParts = await this.executeFunctionCalls(functionCalls, state);
        contents.push(previousContent);
        contents.push({ role: 'user', parts: responseParts });
        const nextTurn = await this.callModelWithRetry(
          contents,
          input.systemInstruction,
          tools,
          deadlineMs,
          input.signal,
          modelUsed
        );
        response = nextTurn.response;
      }

      const text = (response.text || '').trim();
      if (!text) {
        throw new AiProviderUpstreamError(
          502,
          'لم يتمكن المساعد من توليد رد واضح، يرجى إعادة صياغة سؤالك.',
          'ai_empty_response'
        );
      }

      return {
        text,
        provider: 'gemini',
        toolSearchExecuted: state.toolSearchExecuted,
        ...(state.toolSearchExecuted ? { cards: state.collectedCards } : {}),
        ...(state.collectedStats ? { stats: state.collectedStats } : {}),
      };
    } catch (err) {
      throw mapGeminiError(err);
    }
  }

  private async runStreamRoundWithRetry(params: {
    contents: any[];
    systemInstruction: string;
    tools: any[] | undefined;
    deadlineMs: number;
    signal?: AbortSignal;
    preferredModel?: string;
    allowModelFallback: boolean;
    onDelta: (delta: string) => void;
  }): Promise<{
    modelUsed: string;
    accumulatedDelta: string;
    roundFunctionCalls: any[];
    lastModelContentParts: any[];
  }> {
    const candidates = params.allowModelFallback
      ? this.getModelCandidates(params.preferredModel)
      : [params.preferredModel || this.config.model];
    let lastErr: unknown;

    for (let idx = 0; idx < candidates.length; idx += 1) {
      const modelName = candidates[idx];
      const maxAttempts = 2;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let emittedDelta = '';
        const roundFunctionCalls: any[] = [];
        const lastModelContentParts: any[] = [];

        try {
          const stream = await this.runWithDeadline(
            this.client.models.generateContentStream({
              model: modelName,
              contents: params.contents,
              config: this.buildModelConfig(
                modelName,
                params.systemInstruction,
                params.tools,
                params.signal
              ),
            }),
            params.deadlineMs,
            params.signal
          );

          for await (const chunk of stream) {
            if (params.signal?.aborted) break;
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              roundFunctionCalls.push(...chunk.functionCalls);
            }
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              lastModelContentParts.push(...parts);
            }
            const delta = chunk.text || '';
            if (delta) {
              emittedDelta += delta;
              params.onDelta(delta);
            }
          }

          return {
            modelUsed: modelName,
            accumulatedDelta: emittedDelta,
            roundFunctionCalls,
            lastModelContentParts,
          };
        } catch (err) {
          lastErr = err;
          // Never retry or switch models after streaming partial output or function calls to client
          if (
            params.signal?.aborted ||
            emittedDelta.length > 0 ||
            roundFunctionCalls.length > 0
          ) {
            throw err;
          }

          const remainingMs = params.deadlineMs - Date.now();
          if (isRetryableUpstreamError(err) && attempt + 1 < maxAttempts && remainingMs >= 2500) {
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }

          const canTryNextModel =
            idx + 1 < candidates.length &&
            isModelFallbackError(err) &&
            remainingMs >= 2500;
          if (canTryNextModel) {
            break;
          }
          throw err;
        }
      }
    }

    throw lastErr;
  }

  async generateReplyStream(
    input: AiProviderInput,
    callbacks: AiStreamCallbacks
  ): Promise<AiProviderOutput> {
    const contents: any[] = [
      ...input.history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: buildUserParts(input) },
    ];

    const tools = this.resolveToolsForTurn(input);
    const deadlineMs = Date.now() + this.config.timeoutMs;
    const state = {
      collectedCards: [] as AiListingCard[],
      collectedStats: input.context.marketStats ?? null,
      toolSearchExecuted: false,
      toolSearchFailed: false,
    };

    let accumulated = '';
    let activeModel: string | undefined;

    try {
      // Allow bounded tool-calling rounds, streaming any text immediately if the model answers directly
      for (let round = 0; round < 3; round += 1) {
        if (input.signal?.aborted) {
          return {
            text: accumulated,
            provider: 'gemini',
            toolSearchExecuted: state.toolSearchExecuted,
            ...(state.toolSearchExecuted ? { cards: state.collectedCards } : {}),
            ...(state.collectedStats ? { stats: state.collectedStats } : {}),
            interrupted: true,
          };
        }

        const useToolsThisRound = round < 2 ? tools : undefined;
        const roundResult = await this.runStreamRoundWithRetry({
          contents,
          systemInstruction: input.systemInstruction,
          tools: useToolsThisRound,
          deadlineMs,
          signal: input.signal,
          preferredModel: activeModel,
          allowModelFallback: !accumulated,
          onDelta: (delta) => {
            accumulated += delta;
            callbacks.onDelta(delta);
          },
        });
        activeModel = roundResult.modelUsed;

        if (input.signal?.aborted) {
          return {
            text: accumulated,
            provider: 'gemini',
            toolSearchExecuted: state.toolSearchExecuted,
            ...(state.toolSearchExecuted ? { cards: state.collectedCards } : {}),
            ...(state.collectedStats ? { stats: state.collectedStats } : {}),
            interrupted: true,
          };
        }

        if (
          roundResult.roundFunctionCalls.length === 0 ||
          !this.repo ||
          round >= 2
        ) {
          break;
        }

        const responseParts = await this.executeFunctionCalls(
          roundResult.roundFunctionCalls,
          state
        );
        callbacks.onMeta?.({
          ...(state.toolSearchExecuted ? { cards: state.collectedCards } : {}),
          ...(state.collectedStats ? { stats: state.collectedStats } : {}),
        });
        contents.push({
          role: 'model',
          parts:
            roundResult.lastModelContentParts.length > 0
              ? roundResult.lastModelContentParts
              : roundResult.roundFunctionCalls.map((fc) => ({ functionCall: fc })),
        });
        contents.push({ role: 'user', parts: responseParts });
      }

      const trimmed = accumulated.trim();
      if (!trimmed) {
        throw new AiProviderUpstreamError(
          502,
          'لم يتمكن المساعد من توليد رد واضح، يرجى إعادة صياغة سؤالك.',
          'ai_empty_response'
        );
      }

      return {
        text: trimmed,
        provider: 'gemini',
        toolSearchExecuted: state.toolSearchExecuted,
        ...(state.toolSearchExecuted ? { cards: state.collectedCards } : {}),
        ...(state.collectedStats ? { stats: state.collectedStats } : {}),
      };
    } catch (err) {
      if (input.signal?.aborted && accumulated.trim()) {
        return {
          text: accumulated.trim(),
          provider: 'gemini',
          toolSearchExecuted: state.toolSearchExecuted,
          ...(state.toolSearchExecuted ? { cards: state.collectedCards } : {}),
          ...(state.collectedStats ? { stats: state.collectedStats } : {}),
          interrupted: true,
        };
      }
      throw mapGeminiError(err);
    }
  }

  async transcribeAudio(params: {
    audioBuffer: Buffer;
    mimeType: string;
    locale?: 'ar' | 'en';
    signal?: AbortSignal;
  }): Promise<string> {
    const deadlineMs = Date.now() + this.config.timeoutMs;
    const prompt =
      params.locale === 'en'
        ? 'Transcribe this speech accurately into plain text (Arabic/Saudi dialect or English). Return only the transcript with no extra commentary.'
        : 'حوّل هذا التسجيل الصوتي إلى نص عربي أو إنجليزي بدقة مع احترام اللهجة السعودية عند وجودها، وأعد النص المفرغ فقط دون مقدمات.';
    try {
      const response = await this.runWithDeadline(
        this.client.models.generateContent({
          model: DEFAULT_STT_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: params.mimeType,
                  data: params.audioBuffer.toString('base64'),
                },
              },
              { text: prompt },
            ],
          },
          config: params.signal ? { abortSignal: params.signal } : undefined,
        }),
        deadlineMs,
        params.signal
      );
      return (response.text || '').trim();
    } catch (err) {
      throw mapGeminiError(err);
    }
  }

  async synthesizeSpeech(params: {
    text: string;
    locale?: 'ar' | 'en';
    signal?: AbortSignal;
  }): Promise<{ audioBase64: string; mimeType: string }> {
    const deadlineMs = Date.now() + this.config.timeoutMs;
    try {
      const response = await this.runWithDeadline(
        this.client.models.generateContent({
          model: DEFAULT_TTS_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: params.text,
                  speechMetadata: {
                    style:
                      params.locale === 'en'
                        ? 'Clear, warm, helpful marketplace assistant'
                        : 'واضح وهادئ وودود باللهجة العربية الفصحى الميسرة',
                  },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
            ...(params.signal ? { abortSignal: params.signal } : {}),
          },
        }),
        deadlineMs,
        params.signal
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new AiProviderUpstreamError(
          502,
          'تعذر تحويل الرد إلى صوت حالياً.',
          'ai_tts_empty'
        );
      }
      return { audioBase64: base64Audio, mimeType: 'audio/wav' };
    } catch (err) {
      throw mapGeminiError(err);
    }
  }
}
