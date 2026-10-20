# StudyPal API Reference

## Provider selection

Every route picks its LLM configuration per request
(`resolveRequestConfig()` in `src/lib/llm-config.ts`):

1. **Self-host mode.** If the server environment has a key (`LLM_API_KEY` or
   the provider's own variable, e.g. `OPENAI_API_KEY`), or `LLM_PROVIDER` names
   a keyless local preset, the environment decides provider, model and endpoint.
   Request headers are ignored.
2. **Bring-your-own-key mode.** Otherwise these request headers are used:

| Header | Meaning |
|--------|---------|
| `x-llm-provider` | Preset id (`openai`, `openrouter`, `groq`, `deepseek`, `together`, `mistral`, `mimo`, `ollama`, `llamacpp`). Default `openai`. |
| `x-llm-model` | Model id. Default: the preset's default model. |
| `x-llm-key` | The visitor's API key. Forwarded upstream for this request only; never stored or logged. |
| `x-llm-base-url` | Custom OpenAI-compatible base URL. Only accepted when the server sets `LLM_ALLOW_CUSTOM_BASE_URL=1`. |

The server only calls the preset base URLs unless `LLM_ALLOW_CUSTOM_BASE_URL=1`
(the local presets also require it), and it does not follow redirects.
`max_tokens` is set by the server (`LLM_MAX_TOKENS`, default 2048, hard limit 8192).

## Errors

Errors are JSON: `{ "error": "<friendly message>", "code": "<code>" }`.

| Code | HTTP | When |
|------|------|------|
| `bad_request` | 400 | Body is not valid JSON or a field is missing / too long |
| `missing_key` | 400 | No server key and no `x-llm-key` |
| `invalid_key_format` | 400 | Key longer than 512 characters or contains whitespace |
| `unknown_provider` | 400 | `x-llm-provider` is not a preset |
| `provider_not_allowed` | 400 | Local preset requested on a server without the flag |
| `base_url_not_allowed` | 400 | `x-llm-base-url` sent to a server without the flag |
| `invalid_base_url` | 400 | Custom base URL is not a plain http(s) URL |
| `invalid_model` | 400 | Model id contains characters a model id cannot contain |
| `server_misconfigured` | 500 | `LLM_PROVIDER` is not a known preset |
| `invalid_key` | 502 | Provider answered 401 |
| `forbidden` | 502 | Provider answered 403 |
| `model_not_found` | 502 | Provider answered 404 |
| `rate_limited` | 429 | Provider answered 429 |
| `upstream_bad_request` | 502 | Provider answered another 4xx |
| `upstream_unavailable` | 502 | Provider answered 5xx or failed mid-stream |
| `upstream_unreachable` | 502 | Network error |
| `upstream_timeout` | 504 | No response within 60 seconds |
| `unparseable_output` | 502 | The model's answer could not be read as flashcards / a quiz, or was empty |

## Streaming format (`/api/chat`, `/api/summarize`)

`Content-Type: text/event-stream`. Each event is one `data:` line with JSON:

```
data: {"content":"partial answer text"}
data: {"reasoning":"reasoning text, if the model streams reasoning_content"}
data: {"usage":{"prompt_tokens":12,"completion_tokens":40,"total_tokens":52}}
data: [DONE]
```

Configuration and provider errors that happen before the first byte (bad key,
unknown model...) are returned as a normal JSON error with an error status.
A failure after streaming started arrives as
`data: {"error":"...","code":"upstream_unavailable"}` and no `[DONE]` follows.
`usage` is only sent when the provider includes it in its stream.

## Routes

### Answer language

Every POST route accepts an optional `language`: `"en"` (default) or `"ms"`
(Bahasa Melayu; tags such as `"ms-MY"` are accepted too, anything else means
English). The server appends a language rule to the system prompt
(`systemPrompt()` in `src/lib/prompts.ts`); for `"ms"` it asks for standard
Malaysian Malay rather than Indonesian. Flashcards, quizzes and summaries repeat
the rule in the user turn. JSON keys, difficulty values and option letters stay
in English so the parsers keep working. Error messages stay in English; the UI
translates them by `code`.

### `POST /api/chat`

```json
{ "messages": [{ "role": "user", "content": "..." }], "topic": "optional, max 200 chars", "language": "en" }
```

Roles are `user` or `assistant`; each message is at most 8,000 characters and
only the latest 40 messages are sent to the model. Response: SSE.

### `POST /api/flashcards`

```json
{ "topic": "Machine Learning", "count": 8, "difficulty": "mixed", "language": "en" }
```

`count` is clamped to 1–20; `difficulty` is `easy`, `medium`, `hard` or `mixed`.

```json
{
  "flashcards": [
    { "id": "card-…-0", "front": "...", "back": "...", "difficulty": "medium", "tags": ["..."], "mastered": false }
  ],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cached_tokens": 0 },
  "model": "gpt-4o-mini"
}
```

### `POST /api/quiz`

```json
{ "topic": "Calculus", "count": 5, "difficulty": "mixed", "language": "en" }
```

`count` is clamped to 1–10. Questions without at least two options or with a
`correct` letter that matches no option are dropped.

```json
{
  "title": "...",
  "questions": [
    { "question": "...", "options": ["A) ...", "B) ..."], "correct": "A", "explanation": "..." }
  ],
  "usage": { "...": "..." },
  "model": "..."
}
```

### `POST /api/summarize`

```json
{ "content": "text to summarize (max 30,000 characters)", "topic": "optional", "language": "ms" }
```

Response: SSE.

### `GET /api/config`

What the UI may know about the server; never includes a key.

```json
{ "mode": "byok", "allowCustomBaseUrl": false, "maxTokens": 2048 }
```

In self-host mode: `mode: "server"` plus `provider`, `providerLabel`, `model`,
`authStyle` and `endpointHost` (the host name for a preset endpoint, or
`"custom endpoint"`).

## Library functions (server)

| Function | File | Purpose |
|----------|------|---------|
| `resolveRequestConfig(headers, env?)` | `src/lib/llm-config.ts` | Env vs header resolution + allowlist |
| `capMaxTokens(requested?, env?)` | `src/lib/llm-config.ts` | Server-side token cap |
| `chatCompletion(cfg, messages, opts)` | `src/lib/llm.ts` | Non-streaming completion |
| `openCompletionStream(cfg, messages, opts)` | `src/lib/llm.ts` | Streaming completion (async generator) |
| `upstreamError(status)` | `src/lib/llm-errors.ts` | Provider status → friendly error |
