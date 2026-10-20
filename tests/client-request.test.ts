/** @jest-environment node */

import { ApiError, postJson, postStream, splitSSE } from '../src/lib/client/request';
import { defaultSettings } from '../src/lib/client/settings';
import { mockFetch, sseBody } from './helpers';

const KEY = ['browser', 'key', '1'].join('-');
const settings = { ...defaultSettings('openrouter'), apiKey: KEY };

/** Resolve with the ApiError a call rejects with (fails the test if it resolves). */
const failure = (p: Promise<unknown>): Promise<ApiError> =>
  p.then(
    () => {
      throw new Error('expected the call to fail');
    },
    (e: ApiError) => e,
  );

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('postJson', () => {
  it('sends the settings as x-llm-* headers', async () => {
    const fetchMock = mockFetch(Response.json({ ok: true }));
    await expect(postJson('/api/quiz', { topic: 't' }, settings)).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/quiz');
    expect(init.headers).toMatchObject({
      'x-llm-provider': 'openrouter',
      'x-llm-model': 'openai/gpt-4o-mini',
      'x-llm-key': KEY,
    });
  });

  it('turns an API error into an ApiError that knows Settings can fix it', async () => {
    mockFetch(Response.json({ error: 'Add your API key in Settings to use StudyPal.', code: 'missing_key' }, { status: 400 }));
    const err = await failure(postJson('/api/quiz', {}, null));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('missing_key');
    expect(err.needsSettings).toBe(true);
    expect(err.message).toBe('Add your API key in Settings to use StudyPal.');
  });

  it('does not send Settings errors for provider outages', async () => {
    mockFetch(Response.json({ error: 'busy', code: 'upstream_unavailable' }, { status: 502 }));
    const err = await failure(postJson('/api/quiz', {}, settings));
    expect(err.needsSettings).toBe(false);
  });

  it('handles non-JSON failures and network errors', async () => {
    mockFetch(new Response('<html>502</html>', { status: 502 }));
    expect((await failure(postJson('/x', {}, null))).message).toMatch(/HTTP 502/);
    mockFetch(new TypeError('offline'));
    expect((await failure(postJson('/x', {}, null))).code).toBe('network');
  });
});

describe('postStream', () => {
  it('delivers content and usage events until [DONE]', async () => {
    mockFetch(
      new Response(
        sseBody(
          [
            `data: ${JSON.stringify({ content: 'Hi ' })}`,
            `data: ${JSON.stringify({ content: 'there' })}`,
            `data: ${JSON.stringify({ usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } })}`,
            'data: [DONE]',
          ],
          5,
        ),
      ),
    );
    const events: unknown[] = [];
    await postStream('/api/chat', {}, settings, (e) => events.push(e));
    expect(events).toEqual([
      { content: 'Hi ' },
      { content: 'there' },
      { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } },
    ]);
  });

  it('throws an ApiError for an error event inside the stream', async () => {
    mockFetch(new Response(sseBody([`data: ${JSON.stringify({ error: 'The provider rejected your key.', code: 'invalid_key' })}`])));
    const err = await failure(postStream('/api/chat', {}, settings, () => undefined));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('invalid_key');
    expect(err.needsSettings).toBe(true);
  });

  it('throws an ApiError for a JSON error before the stream', async () => {
    mockFetch(Response.json({ error: 'nope', code: 'base_url_not_allowed' }, { status: 400 }));
    await expect(postStream('/api/chat', {}, settings, () => undefined)).rejects.toMatchObject({
      code: 'base_url_not_allowed',
    });
  });
});

describe('splitSSE', () => {
  it('keeps the unfinished line for the next chunk', () => {
    expect(splitSSE('data: {"a":1}\n\ndata: {"b"')).toEqual({ events: ['{"a":1}'], rest: 'data: {"b"' });
  });
});
