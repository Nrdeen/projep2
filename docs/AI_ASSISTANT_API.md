# Mirbah AI Assistant — REST & SSE API Reference

All endpoints are mounted under `/api/v1/ai` in `server.ts`.
- **Identity Resolution**: Uses authenticated user session (`usr:<id>`) when signed in, or an HMAC-signed HTTP-only `mirbah_ai_gid` cookie (`guest:<gid>`) with requester IP quota accounting when anonymous.
- **CSRF & Origin Protection**: All `POST`, `PATCH`, and `DELETE` requests pass through `attachAuth` and `mutationGuard` in `server.ts`, validating allowed `Origin` / `Referer` / `Sec-Fetch-Site` and session-bound `X-CSRF-Token` for signed-in users.

---

## Endpoints

### `GET /api/v1/ai/status`
Returns assistant readiness, active mode, limits, supported voice/multimodal features, and remaining daily quota for the caller. Never exposes `GEMINI_API_KEY`.

**Response `200 OK`**:
```json
{
  "enabled": true,
  "mode": "gemini",
  "geminiConfigured": true,
  "model": "gemini-4-hydrogen",
  "maxMessageLength": 600,
  "limits": {
    "maxAttachmentsPerMessage": 4,
    "maxImageBytes": 5242880,
    "maxPdfBytes": 10485760,
    "maxAudioBytes": 8388608
  },
  "features": {
    "streaming": true,
    "attachments": true,
    "stt": true,
    "tts": true
  },
  "usage": {
    "usedToday": 2,
    "dailyLimit": 30,
    "remainingToday": 28,
    "resetAtUtc": "2026-11-26T00:00:00.000Z"
  }
}
```
- `mode`: `"gemini"` | `"fallback"` (non-production mock) | `"unconfigured"` (production with missing API key).

---

### `POST /api/v1/ai/chat/stream`
Primary SSE streaming chat endpoint supporting text, multi-attachments, function-calling metadata, regeneration, and client abort cancellation.

**Request Body**:
```json
{
  "message": "أبي جذعان نعيمي بالرياض تحت 2000",
  "history": [{ "role": "user", "content": "..." }],
  "conversationId": "conv_...",
  "attachmentIds": ["att_..."],
  "pageContext": {
    "page": "listings",
    "listingId": "lst_101",
    "sellerId": "usr_seller_1",
    "filtersSummary": "نعيمي · منطقة الرياض",
    "locale": "ar"
  },
  "locale": "ar",
  "regenerate": false
}
```

**Pre-stream Error Responses**:
- `503 ai_not_configured`: Server running in production (or `AI_PROVIDER=gemini`) without a configured `GEMINI_API_KEY`.
- `503 ai_disabled`: Assistant disabled via `AI_ASSISTANT_ENABLED=false`.

**SSE Events (`200 OK`, `text/event-stream`)**:
- `event: meta` — `{ "cards"?: AiListingCard[], "stats"?: AiMarketStats, "intent"?: string, "attachments"?: AiAttachmentMeta[] }`
- `event: delta` — `{ "text": "..." }`
- `event: done` — Full `AiChatResponse` (`reply`, `intent`, `provider`, `cards`, `stats`, `suggestedFollowUps`, `usage`, `conversationId`, `userMessageId`, `assistantMessageId`, `attachments`, `interrupted`).
- `event: error` — `{ "error": "...", "code": "...", "status": 400|429|502|503|504 }`

---

### `POST /api/v1/ai/chat`
Unary JSON chat endpoint accepting the same request payload as `/chat/stream` and returning a single `AiChatResponse` JSON object.

---

### Attachments (`/api/v1/ai/attachments`)

- **`POST /api/v1/ai/attachments`**
  - Accepts `multipart/form-data` with field `file`.
  - Validates real binary magic bytes (`JPEG`, `PNG`, `WebP`, `PDF`) and size limits (`5 MB` image / `10 MB` PDF).
  - **Response `201 Created`**: `{ "attachment": { "id", "kind", "name", "mimeType", "sizeBytes", "url", "createdAt" } }`
- **`GET /api/v1/ai/attachments/:id`**
  - Strictly owner-isolated (`404` for non-owners). Returns binary stream with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.
- **`DELETE /api/v1/ai/attachments/:id`**
  - Deletes an unsubmitted or owned attachment (`404` if missing or owned by another user).

---

### Voice Endpoints

- **`POST /api/v1/ai/transcribe`**
  - Accepts `multipart/form-data` audio (`file`, `<= 8 MB`, magic-byte validated `OGG`, `WebM`, `WAV`, `MP3`, `MP4/M4A`), optional header `X-AI-Locale: ar|en`.
  - **Response `200 OK`**: `{ "text": "..." }`
- **`POST /api/v1/ai/tts`**
  - Request JSON: `{ "text": "...", "locale": "ar" | "en" }`.
  - **Response `200 OK`**: `{ "audioBase64": "...", "mimeType": "audio/wav" }`

---

### Conversations & Feedback

- **`GET /api/v1/ai/conversations?q=...`**: Lists caller's saved conversations (`ownerKey`-scoped).
- **`POST /api/v1/ai/conversations`**: Creates an empty conversation (`{ "title"?: string }`).
- **`GET /api/v1/ai/conversations/:id`**: Fetches full conversation thread (`404` if not owner).
- **`PATCH /api/v1/ai/conversations/:id`**: Renames conversation (`{ "title": string }`).
- **`DELETE /api/v1/ai/conversations/:id`**: Deletes conversation and cascade-cleans owned attachments.
- **`POST /api/v1/ai/feedback`**: Records thumbs up/down on a specific assistant message (`{ "conversationId", "messageId", "feedback": "up" | "down" | null }`).
