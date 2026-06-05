/**
 * OpenAI-compatible LLM API client.
 *
 * Works with any provider that speaks the OpenAI `/chat/completions` protocol
 * (OpenAI, OpenRouter, Ollama, llama.cpp, Xiaomi MiMo Token Plan, ...). The auth
 * header style (bearer vs api-key) is chosen automatically from the selected
 * provider preset.
 *
 * Configure with env vars:
 *   LLM_PROVIDER   one of: openai | openrouter | ollama | mimo   (default: mimo)
 *   LLM_API_KEY    API key for the chosen provider
 *                  (legacy MIMO_API_KEY is still honored)
 *   LLM_BASE_URL   override the provider's base URL (optional)
 *   LLM_MODEL      override the default model (optional)
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

type AuthStyle = 'bearer' | 'api-key';

interface ProviderPreset {
  baseUrl: string;
  authStyle: AuthStyle;
  model: string;
  envKey: string;
  envBase: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  mimo: {
    baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
    authStyle: 'api-key',
    model: 'mimo-v2.5-pro',
    envKey: 'MIMO_API_KEY',
    envBase: 'MIMO_BASE_URL',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    authStyle: 'bearer',
    model: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    envBase: 'OPENAI_BASE_URL',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    authStyle: 'bearer',
    model: 'openai/gpt-4o-mini',
    envKey: 'OPENROUTER_API_KEY',
    envBase: 'OPENROUTER_BASE_URL',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    authStyle: 'bearer',
    model: 'llama3.1',
    envKey: 'OLLAMA_API_KEY',
    envBase: 'OLLAMA_BASE_URL',
  },
};

export const DEFAULT_PROVIDER = 'mimo';

export interface ResolvedLLMConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  authStyle: AuthStyle;
}

/** Resolve the active provider config from environment variables. */
export function resolveConfig(): ResolvedLLMConfig {
  const provider = process.env.LLM_PROVIDER || DEFAULT_PROVIDER;
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS[DEFAULT_PROVIDER];

  // Key precedence: explicit LLM_API_KEY > provider-specific env > legacy MIMO_API_KEY.
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env[preset.envKey] ||
    process.env.MIMO_API_KEY ||
    '';

  const baseUrl =
    process.env.LLM_BASE_URL ||
    process.env[preset.envBase] ||
    process.env.MIMO_BASE_URL ||
    preset.baseUrl;

  const model = process.env.LLM_MODEL || process.env.MIMO_MODEL || preset.model;

  return { provider, apiKey, baseUrl, model, authStyle: preset.authStyle };
}

/** Build auth + content headers for the resolved provider. */
export function buildHeaders(cfg: ResolvedLLMConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.authStyle === 'bearer') {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`;
  } else {
    headers['api-key'] = cfg.apiKey;
  }
  return headers;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }
): Promise<ChatResponse> {
  const cfg = resolveConfig();
  if (!cfg.apiKey) throw new Error('No LLM API key set (LLM_API_KEY or provider key)');

  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(cfg),
    body: JSON.stringify({
      model: options?.model || cfg.model,
      messages,
      max_tokens: options?.max_tokens || 4096,
      temperature: options?.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
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
  const cfg = resolveConfig();
  if (!cfg.apiKey) throw new Error('No LLM API key set (LLM_API_KEY or provider key)');

  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(cfg),
    body: JSON.stringify({
      model: options?.model || cfg.model,
      messages,
      max_tokens: options?.max_tokens || 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`LLM API error: ${response.status}`);
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
