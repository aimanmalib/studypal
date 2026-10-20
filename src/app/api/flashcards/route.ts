import { clampInt, errorResponse, parseDifficulty, parseFlashcards, readJsonBody, requireText } from '@/lib/api';
import { chatCompletion } from '@/lib/llm';
import { capMaxTokens, resolveRequestConfig } from '@/lib/llm-config';
import { LLMError } from '@/lib/llm-errors';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

/** Body: { topic, count? (1-20, default 8), difficulty? } */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const topic = requireText(body.topic, 'topic', 200);
    const count = clampInt(body.count, 8, 1, 20);
    const difficulty = parseDifficulty(body.difficulty);
    const cfg = resolveRequestConfig(req.headers);

    const response = await chatCompletion(
      cfg,
      [
        { role: 'system', content: SYSTEM_PROMPTS.flashcards },
        { role: 'user', content: `Generate ${count} flashcards about: ${topic}\nDifficulty: ${difficulty}` },
      ],
      { temperature: 0.6, maxTokens: capMaxTokens() },
    );

    const cards = parseFlashcards(response.content);
    if (cards.length === 0) {
      throw new LLMError(
        'unparseable_output',
        'The model did not return flashcards in the expected format. Try again or pick a stronger model.',
        502,
      );
    }

    const stamp = Date.now();
    return Response.json({
      flashcards: cards.slice(0, count).map((card, i) => ({ id: `card-${stamp}-${i}`, ...card, mastered: false })),
      usage: response.usage,
      model: response.model,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
