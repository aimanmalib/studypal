import { streamCompletion, ChatMessage, trackUsage } from '@/lib/mimo';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, topic } = await req.json();

    const systemMessage: ChatMessage = {
      role: 'system',
      content: SYSTEM_PROMPTS.chat + (topic ? `\n\nCurrent study topic: ${topic}` : ''),
    };

    const chatMessages: ChatMessage[] = [
      systemMessage,
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of streamCompletion(chatMessages, {
            temperature: 0.7,
            max_tokens: 2048,
          })) {
            if (chunk.delta) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk.delta })}\n\n`)
              );
            }
            if (chunk.reasoning_delta) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ reasoning: chunk.reasoning_delta })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'MiMo API error' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
