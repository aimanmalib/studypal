/** @jest-environment node */

import {
  DEFAULT_PROVIDER,
  PROVIDER_IDS,
  PROVIDER_PRESETS,
  isProviderId,
  isValidModel,
} from '../src/lib/providers';

describe('provider presets', () => {
  it('ships the documented presets', () => {
    expect([...PROVIDER_IDS].sort()).toEqual(
      ['deepseek', 'groq', 'llamacpp', 'mimo', 'mistral', 'ollama', 'openai', 'openrouter', 'together'].sort(),
    );
  });

  it('defaults to OpenAI, not a vendor-specific preset', () => {
    expect(DEFAULT_PROVIDER).toBe('openai');
  });

  it('uses https for every hosted provider and marks localhost presets as local', () => {
    for (const id of PROVIDER_IDS) {
      const p = PROVIDER_PRESETS[id];
      const url = new URL(p.baseUrl);
      if (p.local) {
        expect(url.hostname).toBe('localhost');
        expect(p.requiresKey).toBe(false);
      } else {
        expect(url.protocol).toBe('https:');
        expect(p.requiresKey).toBe(true);
      }
      expect(p.baseUrl.endsWith('/')).toBe(false);
    }
  });

  it('has a valid default model for every preset', () => {
    for (const id of PROVIDER_IDS) {
      expect(isValidModel(PROVIDER_PRESETS[id].defaultModel)).toBe(true);
    }
  });

  it('uses the api-key header only for MiMo', () => {
    const apiKeyStyle = PROVIDER_IDS.filter((id) => PROVIDER_PRESETS[id].authStyle === 'api-key');
    expect(apiKeyStyle).toEqual(['mimo']);
  });

  it('recognises provider ids without trusting prototype keys', () => {
    expect(isProviderId('groq')).toBe(true);
    expect(isProviderId('toString')).toBe(false);
    expect(isProviderId('__proto__')).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
  });
});

describe('isValidModel', () => {
  it.each(['gpt-4o-mini', 'openai/gpt-4o-mini', 'llama3.1:8b', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'model@q4+x'])(
    'accepts %s',
    (m) => expect(isValidModel(m)).toBe(true),
  );

  it.each(['', ' gpt', 'gpt 4', 'a\nb', '../../etc', '-flag', 'x'.repeat(201), 'm"odel'])('rejects %j', (m) =>
    expect(isValidModel(m)).toBe(false),
  );
});
