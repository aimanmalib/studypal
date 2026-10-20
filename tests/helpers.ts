/** Shared helpers for tests that fake the upstream LLM provider. */

export function sseBody(lines: string[], splitEvery?: number): ReadableStream<Uint8Array> {
  const text = lines.map((l) => `${l}\n\n`).join('');
  const encoder = new TextEncoder();
  const pieces: string[] = [];
  if (splitEvery) {
    for (let i = 0; i < text.length; i += splitEvery) pieces.push(text.slice(i, i + splitEvery));
  } else {
    pieces.push(text);
  }
  return new ReadableStream({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
}

export const chunk = (content: string, extra: Record<string, unknown> = {}) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content }, ...extra }] })}`;

export function jsonCompletion(content: string, usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }) {
  return new Response(
    JSON.stringify({ model: 'test-model', choices: [{ message: { content }, finish_reason: 'stop' }], usage }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

export function streamResponse(lines: string[]) {
  return new Response(sseBody(lines), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Read an SSE response body into its `data:` payloads. */
export async function readSSE(res: Response): Promise<string[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6));
}

export function mockFetch(...responses: (Response | Error)[]) {
  const fn = jest.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}
