/**
 * Browser-side calls to StudyPal's API routes. Every call carries the
 * visitor's provider settings as `x-llm-*` headers (see `settings.ts`).
 */

import type { LLMErrorCode } from '../llm-errors';
import { SETTINGS_ERROR_CODES } from '../llm-errors';
import type { TokenUsage } from '../llm';
import { LLMSettings, settingsHeaders } from './settings';

export class ApiError extends Error {
  readonly code: LLMErrorCode | 'network';
  readonly status: number;

  constructor(message: string, code: LLMErrorCode | 'network', status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }

  /** True when the fix is in the Settings panel (missing or rejected key, wrong model...). */
  get needsSettings(): boolean {
    return (SETTINGS_ERROR_CODES as readonly string[]).includes(this.code);
  }
}

const NETWORK_MESSAGE = 'Could not reach StudyPal. Check your connection and try again.';

async function errorFromResponse(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: unknown; code?: unknown };
    if (typeof data.error === 'string' && typeof data.code === 'string') {
      return new ApiError(data.error, data.code as LLMErrorCode, res.status);
    }
  } catch {
    // Not our JSON error format; fall through.
  }
  return new ApiError(`Something went wrong (HTTP ${res.status}). Please try again.`, 'upstream_unavailable', res.status);
}

async function send(path: string, body: unknown, settings: LLMSettings | null, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...settingsHeaders(settings) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(NETWORK_MESSAGE, 'network', 0);
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res;
}

export async function postJson<T>(path: string, body: unknown, settings: LLMSettings | null): Promise<T> {
  const res = await send(path, body, settings);
  return (await res.json()) as T;
}

export interface StreamEvent {
  content?: string;
  reasoning?: string;
  usage?: TokenUsage;
}

/**
 * Split an SSE buffer into complete `data:` payloads. Returns the parsed
 * payloads and the unfinished remainder to keep for the next chunk.
 */
export function splitSSE(buffer: string): { events: string[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events = lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  return { events, rest };
}

/** POST and read the SSE answer. Throws ApiError for errors before or during the stream. */
export async function postStream(
  path: string,
  body: unknown,
  settings: LLMSettings | null,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await send(path, body, settings, signal);
  if (!res.body) throw new ApiError(NETWORK_MESSAGE, 'network', res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = splitSSE(buffer);
    buffer = rest;
    for (const data of events) {
      if (data === '[DONE]') return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (typeof parsed.error === 'string') {
        throw new ApiError(parsed.error, (parsed.code as LLMErrorCode) ?? 'upstream_unavailable', res.status);
      }
      onEvent(parsed as StreamEvent);
    }
  }
}
