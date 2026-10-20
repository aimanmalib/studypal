/**
 * Server-side resolution of which LLM provider, model, endpoint and key a
 * request uses. Never import this from client components.
 *
 * Two modes:
 *
 * 1. Self-host mode: the server environment provides a key (`LLM_API_KEY` or
 *    the provider's own variable such as `OPENAI_API_KEY`), or names a local
 *    provider that needs no key. The environment decides everything and
 *    anything the browser sends is ignored.
 *
 * 2. Bring-your-own-key mode (no key in the environment, e.g. the public
 *    demo): the browser sends `x-llm-provider`, `x-llm-model` and `x-llm-key`
 *    with each request. The key is forwarded to the chosen provider for that
 *    one request and is never stored or logged.
 *
 * SSRF guard: in bring-your-own-key mode the server only talks to the base
 * URLs of the hosted presets in `providers.ts`. Local presets (Ollama,
 * llama.cpp) and a custom `x-llm-base-url` are only accepted when
 * `LLM_ALLOW_CUSTOM_BASE_URL=1`, which is meant for a self-hosted instance
 * on your own machine.
 */

import { LLMError } from './llm-errors';
import {
  AuthStyle,
  DEFAULT_PROVIDER,
  PROVIDER_PRESETS,
  ProviderId,
  isProviderId,
  isValidModel,
} from './providers';

export type Env = Record<string, string | undefined>;

export interface ResolvedLLMConfig {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  authStyle: AuthStyle;
  /** Where the config came from. */
  source: 'env' | 'request';
}

/** Request headers the UI sends in bring-your-own-key mode. */
export const LLM_HEADERS = {
  provider: 'x-llm-provider',
  model: 'x-llm-model',
  key: 'x-llm-key',
  baseUrl: 'x-llm-base-url',
} as const;

export const DEFAULT_MAX_TOKENS = 2048;
export const MAX_TOKENS_CEILING = 8192;
const MAX_KEY_LENGTH = 512;

function flag(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

export function customBaseUrlAllowed(env: Env = process.env): boolean {
  return flag(env.LLM_ALLOW_CUSTOM_BASE_URL);
}

/** Server-side cap on completion length, from `LLM_MAX_TOKENS` (default 2048). */
export function maxTokensCap(env: Env = process.env): number {
  const parsed = Number.parseInt(env.LLM_MAX_TOKENS ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TOKENS;
  return Math.min(parsed, MAX_TOKENS_CEILING);
}

/** Clamp a requested max_tokens to the server cap; no request = the cap itself. */
export function capMaxTokens(requested?: number, env: Env = process.env): number {
  const cap = maxTokensCap(env);
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) return cap;
  return Math.min(Math.floor(requested), cap);
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Base URLs the server may call in bring-your-own-key mode. */
export function allowedBaseUrls(env: Env = process.env): string[] {
  const allowLocal = customBaseUrlAllowed(env);
  return Object.values(PROVIDER_PRESETS)
    .filter((p) => allowLocal || !p.local)
    .map((p) => p.baseUrl);
}

/** True when `url` may be called. Custom URLs need LLM_ALLOW_CUSTOM_BASE_URL=1. */
export function isAllowedBaseUrl(url: string, env: Env = process.env): boolean {
  if (customBaseUrlAllowed(env)) return parseHttpUrl(url) !== null;
  return allowedBaseUrls(env).includes(stripTrailingSlash(url));
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * The self-host configuration, or `null` when the environment holds no LLM
 * configuration (bring-your-own-key mode).
 */
export function serverConfigFromEnv(env: Env = process.env): ResolvedLLMConfig | null {
  const rawProvider = env.LLM_PROVIDER?.trim();
  if (rawProvider && !isProviderId(rawProvider)) {
    throw new LLMError(
      'server_misconfigured',
      'This server has an unknown LLM_PROVIDER configured. Ask the site owner to fix it.',
      500,
    );
  }
  const provider: ProviderId = rawProvider && isProviderId(rawProvider) ? rawProvider : DEFAULT_PROVIDER;
  const preset = PROVIDER_PRESETS[provider];

  const apiKey = (env.LLM_API_KEY || env[preset.envKey] || '').trim();
  const keylessLocal = Boolean(rawProvider) && !preset.requiresKey;
  if (!apiKey && !keylessLocal) return null;

  return {
    provider,
    apiKey,
    baseUrl: stripTrailingSlash(env.LLM_BASE_URL || env[preset.envBase] || preset.baseUrl),
    model: env.LLM_MODEL?.trim() || preset.defaultModel,
    authStyle: preset.authStyle,
    source: 'env',
  };
}

interface HeaderSource {
  get(name: string): string | null;
}

/** Resolve the config for one request: environment first, then headers. */
export function resolveRequestConfig(headers: HeaderSource, env: Env = process.env): ResolvedLLMConfig {
  const fromEnv = serverConfigFromEnv(env);
  if (fromEnv) return fromEnv;

  const allowCustom = customBaseUrlAllowed(env);

  const rawProvider = headers.get(LLM_HEADERS.provider)?.trim() || DEFAULT_PROVIDER;
  if (!isProviderId(rawProvider)) {
    throw new LLMError('unknown_provider', 'Unknown provider. Pick one from the list in Settings.', 400);
  }
  const provider = rawProvider;
  const preset = PROVIDER_PRESETS[provider];

  if (preset.local && !allowCustom) {
    throw new LLMError(
      'provider_not_allowed',
      `${preset.label} runs on your own computer, so this hosted app cannot reach it. Self-host StudyPal to use it.`,
      400,
    );
  }

  let baseUrl: string = preset.baseUrl;
  const rawBaseUrl = headers.get(LLM_HEADERS.baseUrl)?.trim();
  if (rawBaseUrl) {
    if (!allowCustom) {
      throw new LLMError(
        'base_url_not_allowed',
        'Custom endpoints are disabled on this server. Pick one of the listed providers.',
        400,
      );
    }
    if (!parseHttpUrl(rawBaseUrl)) {
      throw new LLMError('invalid_base_url', 'The custom endpoint must be an http(s) URL.', 400);
    }
    baseUrl = stripTrailingSlash(rawBaseUrl);
  }
  // Defence in depth: whatever happened above, only allowlisted URLs go out.
  if (!isAllowedBaseUrl(baseUrl, env)) {
    throw new LLMError('base_url_not_allowed', 'That endpoint is not allowed on this server.', 400);
  }

  const model = headers.get(LLM_HEADERS.model)?.trim() || preset.defaultModel;
  if (!isValidModel(model)) {
    throw new LLMError('invalid_model', 'That model name has characters a model id cannot contain.', 400);
  }

  const apiKey = headers.get(LLM_HEADERS.key)?.trim() ?? '';
  if (apiKey.length > MAX_KEY_LENGTH || /\s/.test(apiKey)) {
    throw new LLMError('invalid_key_format', 'That does not look like an API key. Paste it again in Settings.', 400);
  }
  const keyOptional = !preset.requiresKey || Boolean(rawBaseUrl);
  if (!apiKey && !keyOptional) {
    throw new LLMError('missing_key', 'Add your API key in Settings to use StudyPal.', 400);
  }

  return { provider, apiKey, baseUrl, model, authStyle: preset.authStyle, source: 'request' };
}

/** What the UI may know about the server's configuration. Never includes a key. */
export interface PublicServerInfo {
  mode: 'server' | 'byok';
  provider?: ProviderId;
  providerLabel?: string;
  model?: string;
  /** Host name of the endpoint, only when it is the preset's public endpoint. */
  endpointHost?: string;
  authStyle?: AuthStyle;
  allowCustomBaseUrl: boolean;
  maxTokens: number;
  error?: string;
}

export function publicServerInfo(env: Env = process.env): PublicServerInfo {
  const base = { allowCustomBaseUrl: customBaseUrlAllowed(env), maxTokens: maxTokensCap(env) };
  let cfg: ResolvedLLMConfig | null;
  try {
    cfg = serverConfigFromEnv(env);
  } catch (err) {
    return { ...base, mode: 'server', error: (err as Error).message };
  }
  if (!cfg) return { ...base, mode: 'byok' };
  const preset = PROVIDER_PRESETS[cfg.provider];
  return {
    ...base,
    mode: 'server',
    provider: cfg.provider,
    providerLabel: preset.label,
    model: cfg.model,
    endpointHost: cfg.baseUrl === preset.baseUrl ? new URL(cfg.baseUrl).host : 'custom endpoint',
    authStyle: cfg.authStyle,
  };
}
