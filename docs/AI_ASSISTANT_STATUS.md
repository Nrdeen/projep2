# Mirbah AI Assistant (مساعد مِرباح) — Implementation Status & Feature Matrix

## Summary

The Mirbah AI Assistant (`مساعد مِرباح`) is implemented across backend orchestration (`server/ai/`), marketplace function-calling tools, SSE streaming, multimodal uploads, voice STT/TTS, persistent conversations, security guardrails, and the responsive React widget (`src/components/AiAssistantWidget.tsx` & `src/components/ai/*`).

### Readiness Boundary (Honest Current Status)

- **Production Readiness Status**: **NOT YET CERTIFIED FOR PRODUCTION** — `GEMINI_API_KEY` is currently unset in the runtime environment (`hasEnvKey: false`), so live Google Gemini network calls remain unverified.
- **No Production Mock Fallback**: When `NODE_ENV=production`, `AI_PROVIDER=mock` is rejected and silent mock fallbacks are disabled. Without `GEMINI_API_KEY`, `GET /api/v1/ai/status` returns `mode: "unconfigured"` and `/chat`, `/chat/stream`, `/transcribe`, and `/tts` return HTTP `503` (`code: "ai_not_configured"`) without consuming user quota.
- **UI Control & Accessibility Audit**: Every rendered `<button>` and interactive control across `AiAssistantWidget.tsx`, `AiConversationDrawer.tsx`, and `AiCameraModal.tsx` (launcher, minimized pill restore/close, header history/expand/new/more/minimize/close, 4 welcome cards, listing cards, copy, TTS listen/stop, regenerate, like/dislike, follow-ups, retry error action, scroll-to-bottom pill, settings trigger/auto-read switch/voice-lang selector/quick prompts, attach menu image/camera/PDF + camera switch/capture/fallback, pending attachment remove, mic/cancel/insert-stop, send/stop, drawer new/close/search/select/rename/save/cancel/delete/confirm-delete) is wired to live handlers and state — **zero decorative or disconnected controls exist**.

---

## Comprehensive Feature Matrix

> Legend: **Yes (mocked SDK)** = verified against mocked `GoogleGenAI` client; **Yes (mock provider)** = verified end-to-end across HTTP/SSE/DOM using `MockAiProvider` while `GEMINI_API_KEY` is absent; **Blocked (no API key)** = requires live `GEMINI_API_KEY` in Google AI Studio Secrets.

| Feature | Implemented | Connected to Frontend | Connected to Backend | Tested with Mocks | Tested with Real Services | Remaining Limitations |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| Text conversations (AR & EN) | Yes | Yes | Yes | Yes (mock SDK & provider) | Blocked (no API key) | Live `gemini-4-hydrogen` / `gemini-3.1-flash-lite` round-trip pending `GEMINI_API_KEY` |
| Saudi dialect & synonym normalization | Yes | Yes | Yes | Yes (unit + E2E) | Yes (local normalizer & live repo query) | Live Gemini phrasing variations need smoke verification once keyed |
| Streaming SSE & cancellation (`AbortController`) | Yes | Yes | Yes | Yes (mock SDK + SSE E2E) | Blocked (no API key) | Real network chunk cadence pending live key |
| Regenerate response (`regenerate: true`) | Yes | Yes | Yes | Yes (unit, integration, E2E) | Blocked (no API key) | Upstream model variance pending live key |
| Copy, Like/Dislike feedback, Retry, Follow-ups | Yes | Yes | Yes | Yes | Feedback API & UI state verified locally | Live model quality on retries pending key |
| Auto-resizing composer, `/` shortcuts & Settings persistence | Yes | Yes | N/A (client `localStorage`) | Yes (E2E across reload) | Yes (`localStorage` + UI) | None |
| Browser SpeechRecognition STT (`ar-SA` / `en-US`) | Yes | Yes | N/A (browser API) | Yes (mocked `SpeechRecognition` + denied perm E2E) | Blocked (headless env lacks real mic) | Depends on browser support & physical microphone permission |
| Server Audio STT (`POST /api/v1/ai/transcribe`) | Yes | Yes | Yes | Yes (mocked SDK + audio magic-byte integration) | Blocked (no API key) | Live `gemini-3.5-transcribe` accuracy pending key |
| Server TTS (`POST /api/v1/ai/tts`) + Browser `speechSynthesis` | Yes | Yes | Yes | Yes (mocked SDK + E2E click wiring) | Blocked (no API key / headless speaker) | Live `gemini-3.8-flash-lite-tts` WAV playback requires key + browser audio hardware |
| Image uploads & livestock visual inspection | Yes | Yes | Yes | Yes (mocked SDK + E2E upload/send) | Upload/magic-bytes real; inference blocked (no key) | Real Gemini vision quality pending key; never issues vet diagnosis or price certainty |
| Live Camera capture (`AiCameraModal`) & fallback picker | Yes | Yes | Yes (uploads to `/attachments`) | Verified DOM/handler + permission fallback | Blocked (headless env lacks camera) | Real webcam capture requires user browser hardware permission |
| PDF document upload & analysis | Yes | Yes | Yes | Yes (mocked SDK + integration + E2E) | Upload/magic-bytes real; inference blocked (no key) | Scanned/image-only PDF fidelity pending live Gemini test |
| Similar listing lookup from marketplace data | Yes | Yes | Yes | Yes (mocked tool calls) | Real JSON repo verified | Live Gemini tool-call selection pending key |
| Magic-byte validation & attachment limits/TTL | Yes | Yes | Yes | Yes | Yes (real Express multipart & fs store) | Disk cleanup runs on store activity / TTL expiry |
| Conversation history (search, rename, confirm delete, restore) | Yes | Yes | Yes | Yes | Yes (real REST + JSON store persistence across reload & nav) | JSON store per `dataDir` (PostgreSQL table not required unless migrated) |
| Owner isolation & session switching reset | Yes | Yes | Yes | Yes | Yes (user vs guest isolation verified in integration tests) | None |
| Published-only marketplace search, stats & comparisons | Yes | Yes | Yes | Yes | Yes (real repository enforces `Published`, hides private contacts) | Live Postgres test skipped locally (`TEST_DATABASE_URL` unset) |
| Current page context (`page`, `listingId`, `sellerId`, `filtersSummary`) | Yes | Yes | Yes | Yes | Yes (real seller/listing lookup & card nav) | None |
| Per-minute rate limits & daily quotas | Yes | Yes | Yes | Yes | Yes (real in-memory sliding window + UTC daily counters) | In-memory limiter resets if server process restarts |
| Prompt injection & secret/phone redaction guardrails | Yes | Yes | Yes | Yes | Yes (real middleware & `sanitizeAiOutput`) | Defense-in-depth regex redaction alongside system prompt |
| Visual UI (RTL/LTR, Light/Dark, Desktop/Tablet/Mobile) | Yes | Yes | N/A | N/A | Yes (Chromium E2E + visual screenshots across 5 viewports) | Re-verify after connecting live Gemini responses |
