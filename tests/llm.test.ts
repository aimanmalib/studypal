/** @jest-environment node */

import { buildHeaders, chatCompletion, normalizeUsage, openCompletionStream, parseCompletionStream } from '../src/lib/llm';
import type { ResolvedLLMConfig } from '../src/lib/llm-config';
import { LLMError, toLLMError, upstreamError } from '../src/lib/llm-errors';
import { chunk, jsonCompletion, mockFetch, sseBody, streamResponse } from './helpers';

const KEY = ['test', 'key', '789'].join('-');

const cfg: ResolvedLLMConfig = {
  provider: 'openai',
  apiKey: KEY,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  authStyle: 'bearer',
  source: 'request',
};

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('buildHeaders', () => {
  it('sends a bearer token for OpenAI-style providers', () => {
    const h = buildHeaders({ apiKey: KEY, authStyle: 'bearer' });
    expect(h.Authorization).toBe(`Bearer ${KEY}`);
    expect(h['api-key']).toBeUndefined();
  });

  it('sends an api-key header for MiMo-style providers', () => {
    const h = buildHeaders({ apiKey: KEY, authStyle: 'api-key' });
    expect(h['api-key']).toBe(KEY);
    expect(h.Authorization).toBeUndefined();
  });

  it('sends no auth header when there is no key (local models)', () => {
    expect(buildHeaders({ apiKey: '', authStyle: 'bearer' })).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('chatCompletion', () => {
  it('posts to <baseUrl>/chat/completions with the configured model and capped tokens', async () => {
    const fetchMock = mockFetch(jsonCompletion('Hello'));
    const res = await chatCompletion(cfg, [{ role: 'user', content: 'Hi' }], { maxTokens: 512, temperature: 0.2 });

    expect(res.content).toBe('Hello');
    expect(res.usage.total_tokens).toBe(30);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.redirect).toBe('error');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body)).toEqual({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 512,
      temperature: 0.2,
      stream: false,
    });
  });

  it('maps a 401 to a friendly "rejected your key" error without leaking the upstream body', async () => {
    mockFetch(new Response(JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY}` } }), { status: 401 }));
    await expect(chatCompletion(cfg, [], { maxTokens: 10 })).rejects.toMatchObject({
      code: 'invalid_key',
      upstreamStatus: 401,
    });
    mockFetch(new Response(`bad key ${KEY}`, { status: 401 }));
    const err = await chatCompletion(cfg, [], { maxTokens: 10 }).catch((e) => e);
    expect(err.message).toMatch(/provider rejected your key/i);
    expect(err.message).not.toContain(KEY);
  });

  it('turns network failures into upstream_unreachable', async () => {
    mockFetch(new TypeError('fetch failed'));
    await expect(chatCompletion(cfg, [], { maxTokens: 10 })).rejects.toMatchObject({ code: 'upstream_unreachable' });
  });

  it('rejects an empty answer', async () => {
    mockFetch(jsonCompletion(''));
    await expect(chatCompletion(cfg, [], { maxTokens: 10 })).rejects.toMatchObject({ code: 'unparseable_output' });
  });
});

describe('upstream error mapping', () => {
  it.each([
    [401, 'invalid_key', 502],
    [403, 'forbidden', 502],
    [404, 'model_not_found', 502],
    [429, 'rate_limited', 429],
    [400, 'upstream_bad_request', 502],
    [422, 'upstream_bad_request', 502],
    [500, 'upstream_unavailable', 502],
    [503, 'upstream_unavailable', 502],
  ])('HTTP %i -> %s (%i)', (status, code, ours) => {
    const e = upstreamError(status);
    expect(e.code).toBe(code);
    expect(e.status).toBe(ours);
  });

  it('maps aborts to a timeout and keeps LLMErrors as they are', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(toLLMError(abort).code).toBe('upstream_timeout');
    const original = new LLMError('missing_key', 'x', 400);
    expect(toLLMError(original)).toBe(original);
  });
});

describe('streaming', () => {
  it('parses content, reasoning and usage, and stops at [DONE]', async () => {
    const body = sseBody([
      chunk('Hel'),
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'thinking' } }] })}`,
      chunk('lo'),
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } })}`,
      'data: [DONE]',
      chunk('ignored after done'),
    ]);
    const chunks = await collect(parseCompletionStream(body));
    expect(chunks.map((c) => c.delta).join('')).toBe('Hello');
    expect(chunks.find((c) => c.reasoning_delta)?.reasoning_delta).toBe('thinking');
    expect(chunks.find((c) => c.usage)?.usage?.total_tokens).toBe(5);
  });

  it('handles events split across network chunks and skips junk lines', async () => {
    const body = sseBody([': keep-alive', chunk('A'), 'data: {not json', chunk('B'), chunk('C')], 7);
    const chunks = await collect(parseCompletionStream(body));
    expect(chunks.map((c) => c.delta).join('')).toBe('ABC');
  });

  it('raises when the provider sends an error event mid-stream', async () => {
    const body = sseBody([chunk('partial'), `data: ${JSON.stringify({ error: { message: 'overloaded' } })}`]);
    await expect(collect(parseCompletionStream(body))).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });

  it('reports a rejected key before the stream starts', async () => {
    mockFetch(new Response('nope', { status: 401 }));
    await expect(openCompletionStream(cfg, [], { maxTokens: 10 })).rejects.toMatchObject({ code: 'invalid_key' });
  });

  it('requests stream: true', async () => {
    const fetchMock = mockFetch(streamResponse([chunk('x'), 'data: [DONE]']));
    const gen = await openCompletionStream(cfg, [], { maxTokens: 10 });
    await collect(gen);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
  });
});

describe('normalizeUsage', () => {
  it('fills total and cached tokens and ignores empty usage', () => {
    expect(normalizeUsage({ prompt_tokens: 4, completion_tokens: 6, prompt_tokens_details: { cached_tokens: 2 } })).toEqual({
      prompt_tokens: 4,
      completion_tokens: 6,
      total_tokens: 10,
      cached_tokens: 2,
    });
    expect(normalizeUsage({})).toBeUndefined();
    expect(normalizeUsage(null)).toBeUndefined();
  });
});
