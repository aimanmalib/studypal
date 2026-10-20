/** @jest-environment node */

import {
  DEFAULT_MAX_TOKENS,
  MAX_TOKENS_CEILING,
  allowedBaseUrls,
  capMaxTokens,
  isAllowedBaseUrl,
  publicServerInfo,
  resolveRequestConfig,
  serverConfigFromEnv,
} from '../src/lib/llm-config';
import { LLMError } from '../src/lib/llm-errors';

// Benign test values built from parts so no key-like literal appears.
const ENV_KEY = ['env', 'key', '123'].join('-');
const USER_KEY = ['user', 'key', '456'].join('-');

const headers = (h: Record<string, string> = {}) => new Headers(h);

function expectLLMError(fn: () => unknown, code: string, status = 400) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).code).toBe(code);
    expect((err as LLMError).status).toBe(status);
    return;
  }
  throw new Error(`expected LLMError ${code}`);
}

describe('serverConfigFromEnv (self-host mode)', () => {
  it('returns null when the environment holds no key (bring-your-own-key mode)', () => {
    expect(serverConfigFromEnv({})).toBeNull();
  });

  it('uses LLM_API_KEY with the default provider (OpenAI)', () => {
    const cfg = serverConfigFromEnv({ LLM_API_KEY: ENV_KEY });
    expect(cfg).toMatchObject({
      provider: 'openai',
      apiKey: ENV_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      authStyle: 'bearer',
      source: 'env',
    });
  });

  it('uses the provider-specific key variable', () => {
    const cfg = serverConfigFromEnv({ LLM_PROVIDER: 'groq', GROQ_API_KEY: ENV_KEY });
    expect(cfg?.provider).toBe('groq');
    expect(cfg?.apiKey).toBe(ENV_KEY);
    expect(cfg?.baseUrl).toBe('https://api.groq.com/openai/v1');
  });

  it('prefers LLM_API_KEY over the provider-specific key', () => {
    const cfg = serverConfigFromEnv({ LLM_PROVIDER: 'openai', LLM_API_KEY: ENV_KEY, OPENAI_API_KEY: USER_KEY });
    expect(cfg?.apiKey).toBe(ENV_KEY);
  });

  it('ignores a stray MIMO_API_KEY unless LLM_PROVIDER=mimo', () => {
    // A leftover MiMo key must not silently become the default identity.
    expect(serverConfigFromEnv({ MIMO_API_KEY: ENV_KEY })).toBeNull();
    const cfg = serverConfigFromEnv({ LLM_PROVIDER: 'mimo', MIMO_API_KEY: ENV_KEY });
    expect(cfg?.authStyle).toBe('api-key');
    expect(cfg?.baseUrl).toContain('xiaomimimo.com');
  });

  it('treats a keyless local provider as self-host mode', () => {
    const cfg = serverConfigFromEnv({ LLM_PROVIDER: 'ollama' });
    expect(cfg).toMatchObject({ provider: 'ollama', apiKey: '', baseUrl: 'http://localhost:11434/v1' });
  });

  it('applies LLM_BASE_URL and LLM_MODEL overrides', () => {
    const cfg = serverConfigFromEnv({
      LLM_API_KEY: ENV_KEY,
      LLM_BASE_URL: 'https://proxy.example/v1/',
      LLM_MODEL: 'custom-model',
    });
    expect(cfg?.baseUrl).toBe('https://proxy.example/v1');
    expect(cfg?.model).toBe('custom-model');
  });

  it('applies the provider-specific base URL override', () => {
    const cfg = serverConfigFromEnv({ LLM_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://gpu-box:11434/v1' });
    expect(cfg?.baseUrl).toBe('http://gpu-box:11434/v1');
  });

  it('rejects an unknown LLM_PROVIDER instead of guessing', () => {
    expectLLMError(() => serverConfigFromEnv({ LLM_PROVIDER: 'nope', LLM_API_KEY: ENV_KEY }), 'server_misconfigured', 500);
  });
});

describe('resolveRequestConfig', () => {
  it('uses the environment and ignores browser headers in self-host mode', () => {
    const cfg = resolveRequestConfig(
      headers({ 'x-llm-provider': 'groq', 'x-llm-key': USER_KEY, 'x-llm-model': 'other' }),
      { LLM_API_KEY: ENV_KEY },
    );
    expect(cfg).toMatchObject({ provider: 'openai', apiKey: ENV_KEY, model: 'gpt-4o-mini', source: 'env' });
  });

  it('uses the header key, provider and model in bring-your-own-key mode', () => {
    const cfg = resolveRequestConfig(
      headers({ 'x-llm-provider': 'mistral', 'x-llm-key': ` ${USER_KEY} `, 'x-llm-model': 'mistral-large-latest' }),
      {},
    );
    expect(cfg).toMatchObject({
      provider: 'mistral',
      apiKey: USER_KEY,
      model: 'mistral-large-latest',
      baseUrl: 'https://api.mistral.ai/v1',
      source: 'request',
    });
  });

  it('falls back to the default provider and its default model', () => {
    const cfg = resolveRequestConfig(headers({ 'x-llm-key': USER_KEY }), {});
    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe('gpt-4o-mini');
  });

  it('fails with missing_key when neither env nor header has a key', () => {
    expectLLMError(() => resolveRequestConfig(headers(), {}), 'missing_key');
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-provider': 'groq' }), {}), 'missing_key');
  });

  it('rejects unknown providers', () => {
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-provider': 'evil', 'x-llm-key': USER_KEY }), {}), 'unknown_provider');
  });

  it('rejects local providers on a hosted instance', () => {
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-provider': 'ollama' }), {}), 'provider_not_allowed');
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-provider': 'llamacpp' }), {}), 'provider_not_allowed');
  });

  it('rejects a custom base URL unless LLM_ALLOW_CUSTOM_BASE_URL=1', () => {
    const h = headers({ 'x-llm-key': USER_KEY, 'x-llm-base-url': 'http://169.254.169.254/latest' });
    expectLLMError(() => resolveRequestConfig(h, {}), 'base_url_not_allowed');
    expectLLMError(() => resolveRequestConfig(h, { LLM_ALLOW_CUSTOM_BASE_URL: '0' }), 'base_url_not_allowed');
  });

  it('accepts a custom base URL and local providers when the self-host flag is set', () => {
    const env = { LLM_ALLOW_CUSTOM_BASE_URL: '1' };
    const custom = resolveRequestConfig(headers({ 'x-llm-base-url': 'http://localhost:8000/v1/' }), env);
    expect(custom.baseUrl).toBe('http://localhost:8000/v1');
    expect(custom.apiKey).toBe(''); // a custom endpoint may not need a key
    const local = resolveRequestConfig(headers({ 'x-llm-provider': 'ollama' }), env);
    expect(local.baseUrl).toBe('http://localhost:11434/v1');
  });

  it('rejects non-http(s) or credential-bearing custom URLs even with the flag', () => {
    const env = { LLM_ALLOW_CUSTOM_BASE_URL: 'true' };
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-base-url': 'file:///etc/passwd' }), env), 'invalid_base_url');
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-base-url': 'not a url' }), env), 'invalid_base_url');
    expectLLMError(
      () => resolveRequestConfig(headers({ 'x-llm-base-url': 'https://user:pw@example.com/v1' }), env),
      'invalid_base_url',
    );
  });

  it('rejects malformed model names', () => {
    expectLLMError(
      () => resolveRequestConfig(headers({ 'x-llm-key': USER_KEY, 'x-llm-model': 'gpt 4"' }), {}),
      'invalid_model',
    );
  });

  it('rejects keys that are too long or contain whitespace', () => {
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-key': 'a'.repeat(513) }), {}), 'invalid_key_format');
    expectLLMError(() => resolveRequestConfig(headers({ 'x-llm-key': 'two words' }), {}), 'invalid_key_format');
  });
});

describe('base URL allowlist', () => {
  it('contains only the hosted presets by default', () => {
    const urls = allowedBaseUrls({});
    expect(urls).toContain('https://api.openai.com/v1');
    expect(urls).toContain('https://openrouter.ai/api/v1');
    expect(urls.some((u) => u.includes('localhost'))).toBe(false);
  });

  it.each([
    ['https://api.openai.com/v1', true],
    ['https://api.openai.com/v1/', true],
    ['https://api.openai.com.evil.example/v1', false],
    ['https://api.openai.com/v1/../../admin', false],
    ['http://localhost:11434/v1', false],
    ['http://169.254.169.254/latest/meta-data', false],
  ])('%s allowed=%s without the flag', (url, allowed) => {
    expect(isAllowedBaseUrl(url, {})).toBe(allowed);
  });

  it('allows any http(s) URL with the flag, but never other schemes', () => {
    const env = { LLM_ALLOW_CUSTOM_BASE_URL: '1' };
    expect(isAllowedBaseUrl('http://10.0.0.5:8000/v1', env)).toBe(true);
    expect(isAllowedBaseUrl('ftp://example.com', env)).toBe(false);
  });
});

describe('max_tokens cap', () => {
  it('defaults to 2048', () => {
    expect(capMaxTokens(undefined, {})).toBe(DEFAULT_MAX_TOKENS);
    expect(capMaxTokens(100_000, {})).toBe(DEFAULT_MAX_TOKENS);
    expect(capMaxTokens(500, {})).toBe(500);
  });

  it('follows LLM_MAX_TOKENS but never exceeds the hard ceiling', () => {
    expect(capMaxTokens(4096, { LLM_MAX_TOKENS: '1024' })).toBe(1024);
    expect(capMaxTokens(99_999, { LLM_MAX_TOKENS: '999999' })).toBe(MAX_TOKENS_CEILING);
    expect(capMaxTokens(300, { LLM_MAX_TOKENS: 'garbage' })).toBe(300);
    expect(capMaxTokens(-5, {})).toBe(DEFAULT_MAX_TOKENS);
  });
});

describe('publicServerInfo', () => {
  it('reports bring-your-own-key mode without a server key', () => {
    expect(publicServerInfo({})).toEqual({ mode: 'byok', allowCustomBaseUrl: false, maxTokens: 2048 });
  });

  it('reports the configured provider and model but never the key', () => {
    const info = publicServerInfo({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: ENV_KEY, LLM_MODEL: 'deepseek-reasoner' });
    expect(info).toMatchObject({
      mode: 'server',
      provider: 'deepseek',
      providerLabel: 'DeepSeek',
      model: 'deepseek-reasoner',
      endpointHost: 'api.deepseek.com',
    });
    expect(JSON.stringify(info)).not.toContain(ENV_KEY);
  });

  it('hides a private endpoint URL', () => {
    const info = publicServerInfo({ LLM_API_KEY: ENV_KEY, LLM_BASE_URL: 'http://10.1.2.3:8000/v1' });
    expect(info.endpointHost).toBe('custom endpoint');
    expect(JSON.stringify(info)).not.toContain('10.1.2.3');
  });

  it('reports a broken server configuration', () => {
    const info = publicServerInfo({ LLM_PROVIDER: 'nope' });
    expect(info.mode).toBe('server');
    expect(info.error).toMatch(/LLM_PROVIDER/);
  });
});
