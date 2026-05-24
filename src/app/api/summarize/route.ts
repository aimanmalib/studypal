import { streamCompletion, trackUsage } from '@/lib/mimo';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { content, topic } = await req.json();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for await (const chunk of streamCompletion(
          [
            { role: 'system', content: SYSTEM_PROMPTS.summarize },
            { role: 'user', content: `Summarize the following for study purposes:\n\nTopic: ${topic || 'General'}\n\nContent:\n${content}` },
          ],
          { temperature: 0.5, max_tokens: 2048 }
        )) {
          if (chunk.delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk.delta })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to summarize' }, { status: 500 });
  }
}
