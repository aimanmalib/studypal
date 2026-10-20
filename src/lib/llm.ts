/**
 * Minimal client for OpenAI-compatible `/chat/completions` endpoints.
 *
 * Every API route goes through this module with a config from
 * `resolveRequestConfig()` (see `llm-config.ts`). The API key is only ever
 * put in the upstream request header; it is never logged or returned.
 */

import type { ResolvedLLMConfig } from './llm-config';
import { LLMError, toLLMError, upstreamError } from './llm-errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
}

export interface ChatResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  finish_reason: string;
}

export interface StreamChunk {
  delta: string;
  reasoning_delta?: string;
  usage?: TokenUsage;
  finish_reason?: string;
}

export interface CompletionOptions {
  temperature?: number;
  /** Already capped by the caller with `capMaxTokens()`. */
  maxTokens: number;
}

/** How long to wait for the provider to start answering. */
const RESPONSE_TIMEOUT_MS = 60_000;

/** Build auth + content headers for the resolved provider. */
export function buildHeaders(cfg: Pick<ResolvedLLMConfig, 'apiKey' | 'authStyle'>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!cfg.apiKey) return headers;
  if (cfg.authStyle === 'bearer') {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`;
  } else {
    headers['api-key'] = cfg.apiKey;
  }
  return headers;
}

export function normalizeUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  const usage: TokenUsage = {
    prompt_tokens: num(u.prompt_tokens),
    completion_tokens: num(u.completion_tokens),
    total_tokens: num(u.total_tokens) || num(u.prompt_tokens) + num(u.completion_tokens),
    cached_tokens: num(details.cached_tokens),
  };
  return usage.total_tokens > 0 ? usage : undefined;
}

/** POST to the provider; resolves once response headers arrive. */
async function post(
  cfg: ResolvedLLMConfig,
  messages: ChatMessage[],
  opts: CompletionOptions,
  stream: boolean,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.7,
        stream,
      }),
      // Never follow redirects: the allowlist applies to the URL we call.
      redirect: 'error',
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    clearTimeout(timer);
    throw toLLMError(err);
  }
  clearTimeout(timer);

  if (!response.ok) {
    // Drain the body without reading it into logs or errors: some providers
    // echo part of the key back in their error message.
    await response.body?.cancel().catch(() => undefined);
    throw upstreamError(response.status);
  }
  return response;
}

export async function chatCompletion(
  cfg: ResolvedLLMConfig,
  messages: ChatMessage[],
  opts: CompletionOptions,
): Promise<ChatResponse> {
  const response = await post(cfg, messages, opts, false);
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (err) {
    throw toLLMError(err);
  }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = (choices[0] ?? {}) as { message?: { content?: unknown }; finish_reason?: unknown };
  const content = typeof choice.message?.content === 'string' ? choice.message.content : '';
  if (!content) {
    throw new LLMError('unparseable_output', 'The model returned an empty answer. Please try again.', 502);
  }
  return {
    content,
    usage: normalizeUsage(data.usage) ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    model: typeof data.model === 'string' ? data.model : cfg.model,
    finish_reason: typeof choice.finish_reason === 'string' ? choice.finish_reason : '',
  };
}

/** Parse an OpenAI-style SSE body into chunks. */
export async function* parseCompletionStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (parsed.error) {
          throw new LLMError(
            'upstream_unavailable',
            'The provider stopped with an error part-way through. Please try again.',
            502,
          );
        }
        const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
        const choice = (choices[0] ?? {}) as {
          delta?: { content?: unknown; reasoning_content?: unknown };
          finish_reason?: unknown;
        };
        const chunk: StreamChunk = {
          delta: typeof choice.delta?.content === 'string' ? choice.delta.content : '',
        };
        if (typeof choice.delta?.reasoning_content === 'string') chunk.reasoning_delta = choice.delta.reasoning_content;
        if (typeof choice.finish_reason === 'string') chunk.finish_reason = choice.finish_reason;
        const usage = normalizeUsage(parsed.usage);
        if (usage) chunk.usage = usage;
        if (chunk.delta || chunk.reasoning_delta || chunk.usage || chunk.finish_reason) yield chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Start a streaming completion. Resolves only after the provider accepted the
 * request, so a bad key or model is reported as a normal JSON error instead of
 * an error hidden inside a 200 stream.
 */
export async function openCompletionStream(
  cfg: ResolvedLLMConfig,
  messages: ChatMessage[],
  opts: CompletionOptions,
): Promise<AsyncGenerator<StreamChunk>> {
  const response = await post(cfg, messages, opts, true);
  if (!response.body) {
    throw new LLMError('upstream_unavailable', 'The provider sent an empty response. Please try again.', 502);
  }
  return parseCompletionStream(response.body);
}
