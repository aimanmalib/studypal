/**
 * Built-in LLM provider presets.
 *
 * Every preset speaks the OpenAI `/chat/completions` protocol. This module is
 * plain data with no secrets, so both the browser (settings panel) and the
 * server (API routes) import it.
 *
 * The base URLs listed here are also the server's allowlist: in
 * bring-your-own-key mode the server only forwards requests to these URLs
 * (see `src/lib/llm-config.ts`).
 */

export type AuthStyle = 'bearer' | 'api-key';

export interface ProviderPreset {
  /** Human-readable name shown in the UI. */
  label: string;
  /** OpenAI-compatible base URL (the server appends `/chat/completions`). */
  baseUrl: string;
  /** How the API key is sent upstream. */
  authStyle: AuthStyle;
  /** Model used when none is chosen. Editable in Settings / `LLM_MODEL`. */
  defaultModel: string;
  /** Provider-specific env var for the key (self-host mode). */
  envKey: string;
  /** Provider-specific env var that overrides the base URL (self-host mode). */
  envBase: string;
  /** Whether the provider needs an API key at all. */
  requiresKey: boolean;
  /**
   * Local providers point at the server's own network (localhost). They are
   * never reachable from the public demo; see `LLM_ALLOW_CUSTOM_BASE_URL`.
   */
  local: boolean;
  /** Where to get a key (shown as a hint in Settings). */
  keyUrl?: string;
}

export const PROVIDER_PRESETS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    authStyle: 'bearer',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    envBase: 'OPENAI_BASE_URL',
    requiresKey: true,
    local: false,
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    authStyle: 'bearer',
    defaultModel: 'openai/gpt-4o-mini',
    envKey: 'OPENROUTER_API_KEY',
    envBase: 'OPENROUTER_BASE_URL',
    requiresKey: true,
    local: false,
    keyUrl: 'https://openrouter.ai/keys',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    authStyle: 'bearer',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
    envBase: 'GROQ_BASE_URL',
    requiresKey: true,
    local: false,
    keyUrl: 'https://console.groq.com/keys',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    authStyle: 'bearer',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    envBase: 'DEEPSEEK_BASE_URL',
    requiresKey: true,
    local: false,
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    authStyle: 'bearer',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    envKey: 'TOGETHER_API_KEY',
    envBase: 'TOGETHER_BASE_URL',
    requiresKey: true,
    local: false,
    keyUrl: 'https://api.together.ai/settings/api-keys',
  },
  mistral: {
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    authStyle: 'bearer',
    defaultModel: 'mistral-small-latest',
    envKey: 'MISTRAL_API_KEY',
    envBase: 'MISTRAL_BASE_URL',
    requiresKey: true,
    local: false,
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  mimo: {
    label: 'Xiaomi MiMo',
    baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
    authStyle: 'api-key',
    defaultModel: 'mimo-v2.5-pro',
    envKey: 'MIMO_API_KEY',
    envBase: 'MIMO_BASE_URL',
    requiresKey: true,
    local: false,
  },
  ollama: {
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    authStyle: 'bearer',
    defaultModel: 'llama3.1',
    envKey: 'OLLAMA_API_KEY',
    envBase: 'OLLAMA_BASE_URL',
    requiresKey: false,
    local: true,
  },
  llamacpp: {
    label: 'llama.cpp server (local)',
    baseUrl: 'http://localhost:8080/v1',
    authStyle: 'bearer',
    defaultModel: 'default',
    envKey: 'LLAMACPP_API_KEY',
    envBase: 'LLAMACPP_BASE_URL',
    requiresKey: false,
    local: true,
  },
} as const satisfies Record<string, ProviderPreset>;

export type ProviderId = keyof typeof PROVIDER_PRESETS;

export const PROVIDER_IDS = Object.keys(PROVIDER_PRESETS) as ProviderId[];

/** Provider used when nothing is configured. */
export const DEFAULT_PROVIDER: ProviderId = 'openai';

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, value);
}

export function getPreset(id: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS[id];
}

/**
 * Model names are free text in Settings, so they are validated before being
 * forwarded: letters, digits and the punctuation real model ids use
 * (`openai/gpt-4o-mini`, `llama3.1:8b`, `Qwen/Qwen2.5-72B-Instruct@q4`).
 */
export const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/;

export function isValidModel(value: unknown): value is string {
  return typeof value === 'string' && MODEL_PATTERN.test(value);
}
