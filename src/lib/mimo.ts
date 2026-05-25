/**
 * MiMo V2.5 Pro API Client
 *
 * Uses api-key header (NOT Authorization: Bearer) per MiMo Token Plan spec.
 * Endpoint: https://token-plan-sgp.xiaomimimo.com/v1/chat/completions
 * Streaming: SSE with reasoning_content support
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
}

export interface ChatResponse {
  content: string;
  reasoning_content?: string;
  usage: TokenUsage;
  model: string;
  finish_reason: string;
}

export interface StreamChunk {
  delta: string;
  reasoning_delta?: string;
  finish_reason?: string;
}

const MIMO_BASE_URL = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }
): Promise<ChatResponse> {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new Error('MIMO_API_KEY not set');

  const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,  // MiMo uses api-key, NOT Authorization: Bearer
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || MIMO_MODEL,
      messages,
      max_tokens: options?.max_tokens || 4096,
      temperature: options?.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MiMo API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const choice = data.choices[0];
  const usage = data.usage || {};

  return {
    content: choice.message?.content || '',
    reasoning_content: choice.message?.reasoning_content,
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      cached_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
    },
    model: data.model || '',
    finish_reason: choice.finish_reason || '',
  };
}

export async function* streamCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new Error('MIMO_API_KEY not set');

  const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || MIMO_MODEL,
      messages,
      max_tokens: options?.max_tokens || 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`MiMo API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices[0]?.delta || {};
        yield {
          delta: delta.content || '',
          reasoning_delta: delta.reasoning_content,
          finish_reason: parsed.choices[0]?.finish_reason,
        };
      } catch {
        continue;
      }
    }
  }
}

// Token consumption tracker (server-side)
let totalTokens = 0;
let totalCalls = 0;

export function trackUsage(usage: TokenUsage) {
  totalTokens += usage.total_tokens;
  totalCalls++;
}

export function getUsageStats() {
  return { totalTokens, totalCalls };
}
