/**
 * Tests for multi-backend provider configuration.
 */

import {
  DEFAULT_PROVIDER,
  PROVIDER_PRESETS,
  resolveConfig,
  buildHeaders,
} from '../src/lib/mimo';

// Build benign test values from parts so no key-like literal appears.
const KEY_OPENAI = ['k', 'openai'].join('-');
const KEY_LEGACY = ['k', 'legacy'].join('-');
const KEY_EXPLICIT = ['k', 'explicit'].join('-');
const KEY_PROVIDER = ['k', 'provider'].join('-');

describe('Provider presets', () => {
  it('includes the known providers', () => {
    for (const p of ['mimo', 'openai', 'openrouter', 'ollama', 'groq', 'deepseek', 'together', 'mistral']) {
      expect(PROVIDER_PRESETS[p]).toBeDefined();
    }
  });

  it('defaults to mimo', () => {
    expect(DEFAULT_PROVIDER).toBe('mimo');
  });
});

describe('resolveConfig', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    for (const k of [
      'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL',
      'MIMO_API_KEY', 'MIMO_BASE_URL', 'MIMO_MODEL',
      'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
    ]) {
      delete process.env[k];
    }
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('resolves the openai preset', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = KEY_OPENAI;
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toBe('https://api.openai.com/v1');
    expect(cfg.model).toBe('gpt-4o-mini');
    expect(cfg.authStyle).toBe('bearer');
    expect(cfg.apiKey).toBe(KEY_OPENAI);
  });

  it('resolves the ollama preset', () => {
    process.env.LLM_PROVIDER = 'ollama';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toContain('localhost:11434');
    expect(cfg.model).toBe('llama3.1');
  });

  it('resolves the groq preset', () => {
    process.env.LLM_PROVIDER = 'groq';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toContain('api.groq.com');
    expect(cfg.authStyle).toBe('bearer');
    expect(cfg.model).toBe('llama-3.3-70b-versatile');
  });

  it('resolves the deepseek preset', () => {
    process.env.LLM_PROVIDER = 'deepseek';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toContain('api.deepseek.com');
    expect(cfg.authStyle).toBe('bearer');
    expect(cfg.model).toBe('deepseek-chat');
  });

  it('resolves the together preset', () => {
    process.env.LLM_PROVIDER = 'together';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toContain('api.together.xyz');
    expect(cfg.authStyle).toBe('bearer');
  });

  it('resolves the mistral preset', () => {
    process.env.LLM_PROVIDER = 'mistral';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toContain('api.mistral.ai');
    expect(cfg.authStyle).toBe('bearer');
  });

  it('falls back to the default provider when unknown', () => {
    process.env.LLM_PROVIDER = 'does-not-exist';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toContain('xiaomimimo.com');
  });

  it('honors legacy MIMO key for the default provider', () => {
    process.env.MIMO_API_KEY = KEY_LEGACY;
    const cfg = resolveConfig();
    expect(cfg.provider).toBe('mimo');
    expect(cfg.apiKey).toBe(KEY_LEGACY);
    expect(cfg.authStyle).toBe('api-key');
  });

  it('explicit LLM key takes precedence over provider key', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_API_KEY = KEY_EXPLICIT;
    process.env.OPENAI_API_KEY = KEY_PROVIDER;
    expect(resolveConfig().apiKey).toBe(KEY_EXPLICIT);
  });

  it('LLM_BASE_URL / LLM_MODEL override the preset', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_BASE_URL = 'https://proxy.local/v1';
    process.env.LLM_MODEL = 'custom-model';
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toBe('https://proxy.local/v1');
    expect(cfg.model).toBe('custom-model');
  });
});

describe('buildHeaders', () => {
  it('uses bearer auth for openai-style providers', () => {
    const headers = buildHeaders({
      provider: 'openai', apiKey: KEY_OPENAI, baseUrl: 'x', model: 'm', authStyle: 'bearer',
    });
    expect(headers['Authorization']).toBe('Bearer ' + KEY_OPENAI);
    expect(headers['api-key']).toBeUndefined();
  });

  it('uses api-key header for mimo', () => {
    const headers = buildHeaders({
      provider: 'mimo', apiKey: KEY_LEGACY, baseUrl: 'x', model: 'm', authStyle: 'api-key',
    });
    expect(headers['api-key']).toBe(KEY_LEGACY);
    expect(headers['Authorization']).toBeUndefined();
  });
});
