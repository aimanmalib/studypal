import { errorResponse, optionalText, parseChatHistory, readJsonBody, sseResponse } from '@/lib/api';
import { openCompletionStream, type ChatMessage } from '@/lib/llm';
import { capMaxTokens, resolveRequestConfig } from '@/lib/llm-config';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

/** SSE chat. Body: { messages: [{ role, content }], topic? } */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const history = parseChatHistory(body.messages);
    const topic = optionalText(body.topic, 'topic', 200);
    const cfg = resolveRequestConfig(req.headers);

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPTS.chat + (topic ? `\n\nCurrent study topic: ${topic}` : '') },
      ...history,
    ];
    const chunks = await openCompletionStream(cfg, messages, {
      temperature: 0.7,
      maxTokens: capMaxTokens(),
    });
    return sseResponse(chunks);
  } catch (err) {
    return errorResponse(err);
  }
}
