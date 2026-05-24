import { chatCompletion, trackUsage } from '@/lib/mimo';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export async function POST(req: Request) {
  try {
    const { topic, count = 8, difficulty = 'mixed' } = await req.json();

    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPTS.flashcards },
      {
        role: 'user',
        content: `Generate ${count} flashcards about: ${topic}\nDifficulty: ${difficulty}`,
      },
    ], { temperature: 0.6, max_tokens: 2048 });

    trackUsage(response.usage);

    // Parse flashcards from response
    let flashcards;
    try {
      // Try to extract JSON from response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      flashcards = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
    } catch {
      flashcards = [{ front: 'Parse error', back: response.content, difficulty: 'medium', tags: [] }];
    }

    // Add IDs
    flashcards = flashcards.map((card: Record<string, unknown>, i: number) => ({
      id: `card-${Date.now()}-${i}`,
      ...card,
      mastered: false,
    }));

    return Response.json({
      flashcards,
      usage: response.usage,
    });
  } catch (error) {
    return Response.json({ error: 'Failed to generate flashcards' }, { status: 500 });
  }
}
