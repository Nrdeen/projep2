# Mirbah AI Assistant — Architecture & Integration Guide

## Overview

The AI assistant integrates cleanly into the Express + React/Vite marketplace architecture with zero client-side API key exposure (`GEMINI_API_KEY` remains strictly server-side). Both `src/` and production `dist/` bundles were verified clean of any `GEMINI_API_KEY`, `GoogleGenAI`, or `@google/genai` references.

---

## Gemini SDK & Secrets Configuration

### 1. Installed SDK & Configured Models
- **`@google/genai` SDK**: `package.json` declares `"@google/genai": "^2.4.0"`, resolved to **`2.32.0`** in `node_modules/@google/genai/package.json` (satisfies `>= 2.29.1` required for Gemini 4 / 3.8 series and `ThinkingLevel.LOW`). Client sends `User-Agent: aistudio-build` in `httpOptions.headers`.
- **Primary Chat / Multimodal Model**: `gemini-4-hydrogen` (`DEFAULT_AI_MODEL` in `server/ai/config.ts`), using `ThinkingLevel.LOW` and native function declarations. Deprecated models (`gemini-1.5-*`, `gemini-2.0-*`, `gemini-pro`) are automatically rejected back to `gemini-4-hydrogen`.
- **Fallback Chat Model**: `gemini-3.1-flash-lite` (only triggered on pre-output transient 5xx / 429 quota exhaustion before partial stream emission).
- **Speech-to-Text Model**: `gemini-3.5-transcribe` (`DEFAULT_STT_MODEL`).
- **Text-to-Speech Model**: `gemini-3.8-flash-lite-tts` (`DEFAULT_TTS_MODEL`, voice `Kore`, `responseModalities: ['AUDIO']`).
- **Metadata Capability**: `metadata.json` declares `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`.

### 2. Current Environment Status & How to Configure `GEMINI_API_KEY` in Google AI Studio
- **Current Runtime State**: `GEMINI_API_KEY` is **not set** (`hasEnvKey: false`), and only `.env.example` exists on disk.
- **How to Configure in Google AI Studio**:
  1. Open your project in **Google AI Studio Build**.
  2. Navigate to **Settings > Secrets** in the AI Studio UI.
  3. Add (or select/link) a secret named **`GEMINI_API_KEY`** with your valid Gemini API key.
  4. Restart/reload the preview server so AI Studio injects `process.env.GEMINI_API_KEY` server-side automatically. Do **not** prefix it with `VITE_` or place it in client code or `.env` files committed to Git.

---

## Backend Architecture (`server/ai/`)

| File | Responsibility |
| :--- | :--- |
| `config.ts` | Loads env vars (`GEMINI_API_KEY`, `AI_ASSISTANT_ENABLED`, `AI_MODEL`, `AI_PROVIDER`, limits, quotas, timeouts), blocks deprecated Gemini models, and disallows `AI_PROVIDER=mock` in production (`NODE_ENV=production`). |
| `types.ts` | Shared TypeScript interfaces for configs, attachments, normalized queries, page context, listing cards, stats, conversations, and providers. |
| `saudiQueryNormalizer.ts` | Bilingual AR (Saudi dialect + MSA) & EN normalizer extracting livestock breeds (`mentionedBreedIds` + primary `breedId`), regions, cities, price bounds, intent (`greeting`, `casual_chat`, `marketplace_search`, `breed_prices`, `marketplace_help`, `general_livestock`), and clarification state. |
| `marketplaceTools.ts` | Read-only repository adapters querying only `Published` listings (`viewer = null`). Provides `gatherMarketplaceContext`, `executeSearchPublishedListingsTool`, `executeGetBreedPriceGuidesTool`, `executeGetMarketStatsTool`, and `executeCompareListingsOrBreedsTool`. Resolves public `focusedSeller` without exposing phone/email. |
| `systemPrompt.ts` | Builds the Mirbah assistant system instruction including Saudi cultural tone, active `pageContext` (`listingId`, `focusedSeller`, `filtersSummary`), live marketplace grounding, and strict safety rules (no veterinary diagnosis, no price/age/breed certainty from images, explicit confirmation before publishing/modifying account state). |
| `guardrails.ts` | Validates message lengths, blocks prompt-injection / secret-extraction patterns, sanitizes history, and redacts Saudi phone numbers (`05xxxxxxxx` / `+9665xxxxxxxx`), emails, and Google API keys (`AIza...`) from model outputs. |
| `attachments.ts` | Ephemeral attachment storage (`ai-attachments/`) enforcing strict binary magic-byte validation (`JPEG`, `PNG`, `WebP`, `PDF`, `WAV`, `MP3`, `OGG`, `WebM`, `MP4/M4A`), per-type size limits (`5 MB` image / `10 MB` PDF / `8 MB` audio), TTL pruning, path-traversal checks, and strict owner isolation. |
| `conversationsStore.ts` | JSON-persisted owner-isolated conversation threads (`ai-conversations/`), supporting search (`q`), rename, feedback (`up`/`down`), regeneration (`prepareRegenerate`), and cascade cleanup of attached files upon delete. |
| `usageLimiter.ts` | Per-actor sliding per-minute rate limit and UTC-daily quota enforcement for authenticated users and guest IPs. |
| `geminiProvider.ts` | Production `@google/genai` SDK wrapper supporting unary `generateContent`, SSE `generateContentStream`, up to 2 function-calling rounds, multi-image/PDF `inlineData`, `gemini-3.5-transcribe` STT, `gemini-3.8-flash-lite-tts` audio synthesis, deadline enforcement, retry on transient 5xx, model fallback (`gemini-4-hydrogen` -> `gemini-3.1-flash-lite`), and typed upstream error mapping (`429`, `503`, `504`). |
| `mockProvider.ts` | Deterministic non-production provider used in dev/test when `GEMINI_API_KEY` is absent or injected cleanly via `aiProvider`. Strictly disallowed in `NODE_ENV=production`. |
| `service.ts` | Coordinates status, config enforcement (`503 ai_not_configured` if unconfigured in production), attachment resolution, query normalization, marketplace context lookup, provider execution, output redaction, conversation persistence, and localized follow-up generation. |
| `routes.ts` | Express router mounted at `/api/v1/ai` in `server.ts`, using signed HTTP-only `mirbah_ai_gid` cookie for guest continuity and CSRF + Origin checks inherited from `server.ts`. |

---

## Frontend Architecture (`src/components/`)

- `src/components/AiAssistantWidget.tsx`: Floating launcher (`ai-assistant-launcher`) and responsive portal dialog (`ai-assistant-dialog`) rendered in `src/App.tsx` across all pages. Receives `pageContext` (current route, `listingId`, `sellerId`, and computed `filtersSummary`) and keeps active conversation + draft state scoped per `userId || 'guest'`.
- `src/components/ai/SafeMarkdown.tsx`: Sanitized Markdown renderer supporting headings, bold/italic, inline code, lists, and safe `https?://` or `/listings/...` links without raw HTML injection.
- `src/components/ai/AiConversationDrawer.tsx`: History drawer supporting search, rename, delete confirmation, and conversation switching.
- `src/components/ai/AiCameraModal.tsx`: Live `getUserMedia` camera capture overlay (`canvas` JPEG export) with clean fallback to file picker when camera permissions or hardware are unavailable.
- `src/components/ai/useAiVoice.ts`: Combines browser `SpeechRecognition` (`ar-SA` / `en-US` / `auto`), `MediaRecorder` + server `/transcribe` fallback, and server `/tts` + Web `speechSynthesis` audio playback.

---

## Environment Variables (`server/ai/config.ts` defaults)

```dotenv
# Server-only secret — configured via Google AI Studio Settings > Secrets (never use VITE_)
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# Optional overrides (exact defaults in server/ai/config.ts)
AI_ASSISTANT_ENABLED="true"
AI_MODEL="gemini-4-hydrogen"
AI_PROVIDER="auto"            # In NODE_ENV=production, defaults to "gemini" and rejects "mock"
AI_MAX_MESSAGE_LENGTH="600"
AI_MAX_HISTORY_MESSAGES="8"
AI_RATE_LIMIT_PER_MIN="10"
AI_DAILY_USER_QUOTA="30"
AI_DAILY_IP_QUOTA="20"
AI_TIMEOUT_MS="55000"
AI_MAX_ATTACHMENTS="4"
```

Security headers in `server.ts` (`server/auth/middleware.ts`) explicitly permit `camera=(self)` and `microphone=(self)` via `Permissions-Policy` and `media-src 'self' blob: data:` in `Content-Security-Policy` so camera capture and voice playback/recording work seamlessly in the app origin.
