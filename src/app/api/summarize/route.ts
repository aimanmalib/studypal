import { MAX_SUMMARY_INPUT, errorResponse, optionalText, readJsonBody, requireText, sseResponse } from '@/lib/api';
import { openCompletionStream } from '@/lib/llm';
import { capMaxTokens, resolveRequestConfig } from '@/lib/llm-config';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

/** SSE summary. Body: { content, topic? } */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const content = requireText(body.content, 'content', MAX_SUMMARY_INPUT);
    const topic = optionalText(body.topic, 'topic', 200);
    const cfg = resolveRequestConfig(req.headers);

    const chunks = await openCompletionStream(
      cfg,
      [
        { role: 'system', content: SYSTEM_PROMPTS.summarize },
        {
          role: 'user',
          content: `Summarize the following for study purposes:\n\nTopic: ${topic || 'General'}\n\nContent:\n${content}`,
        },
      ],
      { temperature: 0.5, maxTokens: capMaxTokens(2048) },
    );
    return sseResponse(chunks);
  } catch (err) {
    return errorResponse(err);
  }
}
