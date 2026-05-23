# StudyPal API Reference

## MiMo API Client

### `chatCompletion(messages, options?)`

Non-streaming chat completion.

```typescript
const response = await chatCompletion([
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Explain AI.' },
], { temperature: 0.7, max_tokens: 2048 });

console.log(response.content);
console.log(response.usage.total_tokens);
```

### `streamCompletion(messages, options?)`

Async generator for SSE streaming.

```typescript
for await (const chunk of streamCompletion(messages)) {
  process.stdout.write(chunk.delta);
}
```

**Important**: Uses `api-key` header, NOT `Authorization: Bearer`.

### `trackUsage(usage)`

Track token consumption server-side.

### `getUsageStats()`

Get current session token stats.

## API Routes

### `POST /api/chat`

SSE streaming chat endpoint.

**Request:**
```json
{
  "messages": [{"role": "user", "content": "..."}],
  "topic": "optional topic context"
}
```

**Response:** SSE stream with `data: {"content": "..."}` chunks.

### `POST /api/flashcards`

Generate flashcards.

**Request:**
```json
{ "topic": "Machine Learning", "count": 8, "difficulty": "mixed" }
```

**Response:**
```json
{
  "flashcards": [
    { "id": "...", "front": "...", "back": "...", "difficulty": "medium", "tags": [...] }
  ],
  "usage": { "prompt_tokens": N, "completion_tokens": N, "total_tokens": N }
}
```

### `POST /api/quiz`

Generate quiz questions.

**Request:**
```json
{ "topic": "Calculus", "count": 5 }
```

**Response:**
```json
{
  "title": "...",
  "questions": [
    { "question": "...", "options": ["A) ...", "B) ..."], "correct": "A", "explanation": "..." }
  ],
  "usage": { ... }
}
```

### `POST /api/summarize`

SSE streaming summarization.

**Request:**
```json
{ "content": "text to summarize...", "topic": "optional" }
```

**Response:** SSE stream.
