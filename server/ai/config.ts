import type { AiConfig } from './types';

export const DEFAULT_AI_MODEL = 'gemini-4-hydrogen';
export const DEFAULT_STT_MODEL = 'gemini-3.5-transcribe';
export const DEFAULT_TTS_MODEL = 'gemini-3.8-flash-lite-tts';

const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
]);

function intFromEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value || !value.trim()) return fallback;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

function sanitizeApiKey(raw: string | undefined): string {
  const key = (raw || '').trim();
  if (!key) return '';
  if (key === 'MY_GEMINI_API_KEY' || key.startsWith('REPLACE_WITH_')) {
    return '';
  }
  return key;
}

function resolveModel(raw: string | undefined): string {
  const model = (raw || '').trim();
  if (!model || DEPRECATED_MODELS.has(model)) {
    return DEFAULT_AI_MODEL;
  }
  return model;
}

function resolveProviderMode(
  raw: string | undefined,
  isProduction: boolean
): 'auto' | 'gemini' | 'mock' {
  const mode = (raw || '').trim().toLowerCase();
  if (mode === 'gemini' || mode === 'auto') {
    return mode;
  }
  if (mode === 'mock') {
    // Mock provider is strictly prohibited in production environments
    return isProduction ? 'gemini' : 'mock';
  }
  return isProduction ? 'gemini' : 'auto';
}

export function loadAiConfig(
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<AiConfig> = {}
): AiConfig {
  const isProduction = (env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const enabled = (env.AI_ASSISTANT_ENABLED || 'true').trim().toLowerCase() !== 'false';
  const geminiApiKey = sanitizeApiKey(env.GEMINI_API_KEY);
  const model = resolveModel(env.AI_MODEL);
  const providerMode = resolveProviderMode(env.AI_PROVIDER, isProduction);

  const merged: AiConfig = {
    enabled,
    isProduction,
    geminiApiKey,
    model,
    providerMode,
    maxMessageLength: intFromEnv(env.AI_MAX_MESSAGE_LENGTH, 600, 100, 2000),
    maxHistoryMessages: intFromEnv(env.AI_MAX_HISTORY_MESSAGES, 8, 0, 20),
    rateLimitPerMinute: intFromEnv(env.AI_RATE_LIMIT_PER_MIN, 10, 1, 120),
    dailyUserQuota: intFromEnv(env.AI_DAILY_USER_QUOTA, 30, 1, 500),
    dailyIpQuota: intFromEnv(env.AI_DAILY_IP_QUOTA, 20, 1, 500),
    timeoutMs: intFromEnv(env.AI_TIMEOUT_MS, 55_000, 1_000, 90_000),
    maxAttachmentsPerMessage: intFromEnv(env.AI_MAX_ATTACHMENTS, 4, 1, 6),
    maxImageBytes: intFromEnv(env.AI_MAX_IMAGE_BYTES, 5 * 1024 * 1024, 64 * 1024, 15 * 1024 * 1024),
    maxPdfBytes: intFromEnv(env.AI_MAX_PDF_BYTES, 10 * 1024 * 1024, 64 * 1024, 20 * 1024 * 1024),
    maxAudioBytes: intFromEnv(env.AI_MAX_AUDIO_BYTES, 8 * 1024 * 1024, 64 * 1024, 20 * 1024 * 1024),
    attachmentTtlMs: intFromEnv(env.AI_ATTACHMENT_TTL_MS, 24 * 60 * 60 * 1000, 60_000, 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
  if (merged.isProduction && merged.providerMode === 'mock') {
    merged.providerMode = 'gemini';
  }
  return merged;
}
