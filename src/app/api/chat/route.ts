import { errorResponse, optionalText, parseChatHistory, readJsonBody, sseResponse } from '@/lib/api';
import { openCompletionStream, type ChatMessage } from '@/lib/llm';
import { capMaxTokens, resolveRequestConfig } from '@/lib/llm-config';
import { parseLanguage } from '@/lib/language';
import { systemPrompt } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

/** SSE chat. Body: { messages: [{ role, content }], topic?, language? ('en' | 'ms') } */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const history = parseChatHistory(body.messages);
    const topic = optionalText(body.topic, 'topic', 200);
    const language = parseLanguage(body.language);
    const cfg = resolveRequestConfig(req.headers);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt('chat', language) + (topic ? `\n\nCurrent study topic: ${topic}` : '') },
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
