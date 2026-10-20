/**
 * Helpers shared by the API route handlers: input validation, JSON errors and
 * the SSE response format the UI reads.
 *
 * SSE events sent to the browser (one JSON object per `data:` line):
 *   { "content": "..." }            answer text
 *   { "reasoning": "..." }          reasoning text, when the model streams it
 *   { "usage": { ...TokenUsage } }  token usage, when the provider reports it
 *   { "error": "...", "code": "..." } a failure after the stream started
 *   [DONE]                          end of stream
 */

import { LLMError, toLLMError } from './llm-errors';
import type { ChatMessage, StreamChunk } from './llm';

export function badRequest(message: string): LLMError {
  return new LLMError('bad_request', message, 400);
}

/** JSON error response. Messages are the friendly ones from LLMError only. */
export function errorResponse(err: unknown): Response {
  const e = toLLMError(err);
  return Response.json({ error: e.message, code: e.code }, { status: e.status });
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('The request body must be JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('The request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`"${field}" is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw badRequest(`"${field}" is too long (max ${maxLength} characters).`);
  return text;
}

export function optionalText(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null || value === '') return '';
  return requireText(value, field, maxLength);
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function parseDifficulty(value: unknown): Difficulty {
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : 'mixed';
}

export const CHAT_LIMITS = { maxMessages: 40, maxMessageLength: 8000 } as const;
export const MAX_SUMMARY_INPUT = 30_000;

/** Validate the chat history the browser sends. */
export function parseChatHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('"messages" must be a non-empty array.');
  // Keep the most recent turns so long conversations still work.
  const recent = value.slice(-CHAT_LIMITS.maxMessages);
  return recent.map((m) => {
    const msg = (m ?? {}) as Record<string, unknown>;
    if (msg.role !== 'user' && msg.role !== 'assistant') throw badRequest('Each message needs role "user" or "assistant".');
    if (typeof msg.content !== 'string') throw badRequest('Each message needs text content.');
    if (msg.content.length > CHAT_LIMITS.maxMessageLength) {
      throw badRequest(`A message is too long (max ${CHAT_LIMITS.maxMessageLength} characters).`);
    }
    return { role: msg.role, content: msg.content };
  });
}

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

/** Wrap a completion stream as the SSE response the UI expects. */
export function sseResponse(chunks: AsyncGenerator<StreamChunk>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          if (chunk.delta) controller.enqueue(sse({ content: chunk.delta }));
          if (chunk.reasoning_delta) controller.enqueue(sse({ reasoning: chunk.reasoning_delta }));
          if (chunk.usage) controller.enqueue(sse({ usage: chunk.usage }));
        }
        controller.enqueue(sse('[DONE]'));
      } catch (err) {
        const e = toLLMError(err);
        controller.enqueue(sse({ error: e.message, code: e.code }));
      } finally {
        controller.close();
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Pull the first JSON value of the given shape out of a model's answer. */
function extractJson(text: string, open: '[' | '{'): unknown {
  const close = open === '[' ? ']' : '}';
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export interface Flashcard {
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

/** Parse flashcards from a model answer; returns [] when nothing usable. */
export function parseFlashcards(text: string): Flashcard[] {
  const json = extractJson(text, '[');
  if (!Array.isArray(json)) return [];
  return json.flatMap((item) => {
    const c = (item ?? {}) as Record<string, unknown>;
    if (typeof c.front !== 'string' || typeof c.back !== 'string' || !c.front.trim() || !c.back.trim()) return [];
    const difficulty = c.difficulty === 'easy' || c.difficulty === 'hard' ? c.difficulty : 'medium';
    const tags = Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string').slice(0, 8) : [];
    return [{ front: c.front.trim(), back: c.back.trim(), difficulty, tags }];
  });
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
}

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

/** Parse a quiz from a model answer; questions without valid fields are dropped. */
export function parseQuiz(text: string, fallbackTitle: string): Quiz {
  const json = extractJson(text, '{') as Record<string, unknown> | undefined;
  const rawQuestions = json && Array.isArray(json.questions) ? json.questions : [];
  const questions = rawQuestions.flatMap((item) => {
    const q = (item ?? {}) as Record<string, unknown>;
    const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string') : [];
    if (typeof q.question !== 'string' || options.length < 2 || typeof q.correct !== 'string') return [];
    const correct = q.correct.trim().charAt(0).toUpperCase();
    if (!options.some((o) => o.trim().charAt(0).toUpperCase() === correct)) return [];
    return [{
      question: q.question.trim(),
      options: options.map((o) => o.trim()),
      correct,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    }];
  });
  const title = json && typeof json.title === 'string' && json.title.trim() ? json.title.trim() : fallbackTitle;
  return { title, questions };
}
