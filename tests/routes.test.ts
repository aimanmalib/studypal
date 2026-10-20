/** @jest-environment node */

import { POST as chatPOST } from '../src/app/api/chat/route';
import { GET as configGET } from '../src/app/api/config/route';
import { POST as flashcardsPOST } from '../src/app/api/flashcards/route';
import { POST as quizPOST } from '../src/app/api/quiz/route';
import { POST as summarizePOST } from '../src/app/api/summarize/route';
import { chunk, jsonCompletion, mockFetch, readSSE, streamResponse } from './helpers';

const USER_KEY = ['user', 'key', 'abc'].join('-');
const ENV_KEY = ['env', 'key', 'xyz'].join('-');

const LLM_ENV = [
  'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'LLM_MAX_TOKENS', 'LLM_ALLOW_CUSTOM_BASE_URL',
  'OPENAI_API_KEY', 'MIMO_API_KEY', 'GROQ_API_KEY',
];

const realFetch = global.fetch;
const realEnv = process.env;
let logSpies: jest.SpyInstance[];

beforeEach(() => {
  process.env = { ...realEnv };
  for (const k of LLM_ENV) delete process.env[k];
  logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    jest.spyOn(console, m).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  // The API key must never reach the logs.
  for (const spy of logSpies) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain(USER_KEY);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(ENV_KEY);
    spy.mockRestore();
  }
  global.fetch = realFetch;
  process.env = realEnv;
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const byok = (extra: Record<string, string> = {}) => ({ 'x-llm-provider': 'openai', 'x-llm-key': USER_KEY, ...extra });
const chatBody = { messages: [{ role: 'user', content: 'What is entropy?' }], topic: 'Physics' };

describe('POST /api/chat', () => {
  it('returns 400 missing_key when neither the server nor the browser has a key', async () => {
    const fetchMock = mockFetch();
    const res = await chatPOST(request(chatBody));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Add your API key in Settings to use StudyPal.', code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the header key to the chosen provider and streams the answer', async () => {
    const fetchMock = mockFetch(streamResponse([chunk('Entropy '), chunk('is disorder.'), 'data: [DONE]']));
    const res = await chatPOST(request(chatBody, byok({ 'x-llm-provider': 'groq', 'x-llm-model': 'llama-3.1-8b-instant' })));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const events = await readSSE(res);
    expect(events).toEqual([
      JSON.stringify({ content: 'Entropy ' }),
      JSON.stringify({ content: 'is disorder.' }),
      '[DONE]',
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${USER_KEY}`);
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('llama-3.1-8b-instant');
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[0].content).toContain('Current study topic: Physics');
    expect(sent.messages[1]).toEqual({ role: 'user', content: 'What is entropy?' });
  });

  it('uses the server key in self-host mode and ignores the browser key', async () => {
    process.env.LLM_API_KEY = ENV_KEY;
    const fetchMock = mockFetch(streamResponse([chunk('ok'), 'data: [DONE]']));
    await (await chatPOST(request(chatBody, byok({ 'x-llm-provider': 'groq' })))).text();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${ENV_KEY}`);
  });

  it('turns an upstream 401 into a friendly JSON error', async () => {
    mockFetch(new Response(`{"error":{"message":"Incorrect API key provided: ${USER_KEY}"}}`, { status: 401 }));
    const res = await chatPOST(request(chatBody, byok()));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(JSON.parse(text)).toEqual({
      error: 'The provider rejected your key. Check that it is correct and still active.',
      code: 'invalid_key',
    });
    expect(text).not.toContain(USER_KEY);
  });

  it('reports errors that happen after streaming started as an SSE error event', async () => {
    mockFetch(streamResponse([chunk('Half an'), `data: ${JSON.stringify({ error: { message: 'boom' } })}`]));
    const events = await readSSE(await chatPOST(request(chatBody, byok())));
    expect(events[0]).toBe(JSON.stringify({ content: 'Half an' }));
    expect(JSON.parse(events[1])).toMatchObject({ code: 'upstream_unavailable' });
    expect(events).not.toContain('[DONE]');
  });

  it('refuses custom base URLs and local providers on a hosted instance (SSRF guard)', async () => {
    const fetchMock = mockFetch();
    const custom = await chatPOST(request(chatBody, byok({ 'x-llm-base-url': 'http://169.254.169.254/latest' })));
    expect(custom.status).toBe(400);
    expect((await custom.json()).code).toBe('base_url_not_allowed');
    const local = await chatPOST(request(chatBody, { 'x-llm-provider': 'ollama' }));
    expect((await local.json()).code).toBe('provider_not_allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a custom base URL when LLM_ALLOW_CUSTOM_BASE_URL=1', async () => {
    process.env.LLM_ALLOW_CUSTOM_BASE_URL = '1';
    const fetchMock = mockFetch(streamResponse([chunk('local'), 'data: [DONE]']));
    await (await chatPOST(request(chatBody, { 'x-llm-base-url': 'http://localhost:8000/v1' }))).text();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/v1/chat/completions');
  });

  it('caps max_tokens with LLM_MAX_TOKENS', async () => {
    process.env.LLM_MAX_TOKENS = '256';
    const fetchMock = mockFetch(streamResponse(['data: [DONE]']));
    await (await chatPOST(request(chatBody, byok()))).text();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(256);
  });

  it('uses LLM_MAX_TOKENS as the per-answer budget, up to the hard ceiling', async () => {
    process.env.LLM_MAX_TOKENS = '4096';
    const fetchMock = mockFetch(streamResponse(['data: [DONE]']), streamResponse(['data: [DONE]']));
    await (await chatPOST(request(chatBody, byok()))).text();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4096);
    process.env.LLM_MAX_TOKENS = '100000';
    await (await chatPOST(request(chatBody, byok()))).text();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(8192);
  });

  it('validates the body', async () => {
    const fetchMock = mockFetch();
    for (const body of ['not json', {}, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }]) {
      const res = await chatPOST(request(body, byok()));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('bad_request');
    }
    const tooLong = await chatPOST(request({ messages: [{ role: 'user', content: 'x'.repeat(8001) }] }, byok()));
    expect(tooLong.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only sends the most recent 40 turns', async () => {
    const fetchMock = mockFetch(streamResponse(['data: [DONE]']));
    const messages = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    await (await chatPOST(request({ messages }, byok()))).text();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    expect(sent).toHaveLength(41); // system + 40
    expect(sent[1].content).toBe('m10');
  });
});

describe('POST /api/flashcards', () => {
  const cards = [
    { front: 'What is ATP?', back: 'The cell energy currency', difficulty: 'easy', tags: ['biology'] },
    { front: 'Mitochondria?', back: 'Powerhouse', difficulty: 'weird', tags: 'x' },
    { front: '', back: 'dropped' },
  ];

  it('generates validated flashcards and reports usage', async () => {
    const fetchMock = mockFetch(jsonCompletion('Here you go:\n```json\n' + JSON.stringify(cards) + '\n```'));
    const res = await flashcardsPOST(request({ topic: 'Cells', count: 99 }, byok()));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.flashcards).toHaveLength(2);
    expect(data.flashcards[0]).toMatchObject({ front: 'What is ATP?', difficulty: 'easy', tags: ['biology'], mastered: false });
    expect(data.flashcards[1]).toMatchObject({ difficulty: 'medium', tags: [] });
    expect(data.flashcards[0].id).toMatch(/^card-/);
    expect(data.usage.total_tokens).toBe(30);
    // count is clamped to 20 before it reaches the prompt
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content).toContain('Generate 20 flashcards');
  });

  it('returns a clear error when the model output is not flashcards', async () => {
    mockFetch(jsonCompletion('Sorry, I cannot help with that.'));
    const res = await flashcardsPOST(request({ topic: 'Cells' }, byok()));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('unparseable_output');
  });

  it('requires a topic and a key', async () => {
    mockFetch();
    expect((await (await flashcardsPOST(request({}, byok()))).json()).code).toBe('bad_request');
    expect((await (await flashcardsPOST(request({ topic: 'x' }))).json()).code).toBe('missing_key');
  });

  it('surfaces rate limits as 429', async () => {
    mockFetch(new Response('slow down', { status: 429 }));
    const res = await flashcardsPOST(request({ topic: 'Cells' }, byok()));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('rate_limited');
  });
});

describe('POST /api/quiz', () => {
  it('returns only well-formed questions', async () => {
    const quiz = {
      title: 'Derivatives',
      questions: [
        { question: 'd/dx x^2?', options: ['A) 2x', 'B) x', 'C) 2', 'D) x^2'], correct: 'A', explanation: 'Power rule' },
        { question: 'Broken', options: ['A) only one'], correct: 'A' },
        { question: 'Wrong letter', options: ['A) 1', 'B) 2'], correct: 'E' },
      ],
    };
    mockFetch(jsonCompletion(JSON.stringify(quiz)));
    const res = await quizPOST(request({ topic: 'Calculus', count: 5 }, byok()));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.title).toBe('Derivatives');
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0]).toMatchObject({ correct: 'A', explanation: 'Power rule' });
  });

  it('errors when no usable question comes back', async () => {
    mockFetch(jsonCompletion('{"title":"x","questions":[]}'));
    const res = await quizPOST(request({ topic: 'Calculus' }, byok()));
    expect((await res.json()).code).toBe('unparseable_output');
  });
});

describe('POST /api/summarize', () => {
  it('streams a summary', async () => {
    const fetchMock = mockFetch(streamResponse([chunk('# Summary'), 'data: [DONE]']));
    const events = await readSSE(await summarizePOST(request({ content: 'Long text', topic: 'History' }, byok())));
    expect(events).toEqual([JSON.stringify({ content: '# Summary' }), '[DONE]']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content).toContain('Topic: History');
  });

  it('rejects input over the limit', async () => {
    mockFetch();
    const res = await summarizePOST(request({ content: 'x'.repeat(30_001) }, byok()));
    expect(res.status).toBe(400);
  });

  it('asks for a key when none is configured', async () => {
    mockFetch();
    const res = await summarizePOST(request({ content: 'text' }));
    expect((await res.json()).code).toBe('missing_key');
  });
});

describe('GET /api/config', () => {
  it('reports bring-your-own-key mode', async () => {
    const data = await configGET().json();
    expect(data.mode).toBe('byok');
  });

  it('reports self-host mode without exposing the key', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = ENV_KEY;
    const res = configGET();
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ mode: 'server', provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(text).not.toContain(ENV_KEY);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
