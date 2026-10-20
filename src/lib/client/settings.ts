/**
 * The visitor's provider settings for bring-your-own-key mode.
 *
 * Stored ONLY in this browser's localStorage. They travel to this app's own
 * API routes as request headers (`x-llm-*`) with each request, and the server
 * forwards the key to the chosen provider without storing or logging it.
 */

import { DEFAULT_PROVIDER, PROVIDER_PRESETS, ProviderId, isProviderId } from '../providers';

export interface LLMSettings {
  provider: ProviderId;
  model: string;
  apiKey: string;
  /** Only used when the server sets LLM_ALLOW_CUSTOM_BASE_URL=1. */
  baseUrl: string;
}

export const SETTINGS_STORAGE_KEY = 'studypal.llm-settings.v1';

export function defaultSettings(provider: ProviderId = DEFAULT_PROVIDER): LLMSettings {
  return { provider, model: PROVIDER_PRESETS[provider].defaultModel, apiKey: '', baseUrl: '' };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Blocked storage (private mode, disabled site data) throws on access.
    return null;
  }
}

export function loadSettings(storage: StorageLike | null = browserStorage()): LLMSettings | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<LLMSettings>;
    if (!isProviderId(data.provider)) return null;
    return {
      provider: data.provider,
      model: typeof data.model === 'string' && data.model.trim() ? data.model.trim() : PROVIDER_PRESETS[data.provider].defaultModel,
      apiKey: typeof data.apiKey === 'string' ? data.apiKey : '',
      baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : '',
    };
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store (the settings still apply for this tab). */
export function saveSettings(settings: LLMSettings, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearSettings(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // Nothing else to do: storage is unavailable.
  }
}

/** Headers that carry the settings to this app's API routes. */
export function settingsHeaders(settings: LLMSettings | null): Record<string, string> {
  if (!settings) return {};
  const headers: Record<string, string> = {
    'x-llm-provider': settings.provider,
    'x-llm-model': settings.model.trim() || PROVIDER_PRESETS[settings.provider].defaultModel,
  };
  if (settings.apiKey.trim()) headers['x-llm-key'] = settings.apiKey.trim();
  if (settings.baseUrl.trim()) headers['x-llm-base-url'] = settings.baseUrl.trim();
  return headers;
}

/** "sk-…a1b2" style hint so the visitor can tell which key is saved. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return `${k.slice(0, 3)}…${k.slice(-4)}`;
}
