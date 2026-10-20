import { clampInt, errorResponse, parseDifficulty, parseQuiz, readJsonBody, requireText } from '@/lib/api';
import { chatCompletion } from '@/lib/llm';
import { capMaxTokens, resolveRequestConfig } from '@/lib/llm-config';
import { LLMError } from '@/lib/llm-errors';
import { parseLanguage } from '@/lib/language';
import { languageReminder, systemPrompt } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

/** Body: { topic, count? (1-10, default 5), difficulty?, language? ('en' | 'ms') } */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const topic = requireText(body.topic, 'topic', 200);
    const count = clampInt(body.count, 5, 1, 10);
    const difficulty = parseDifficulty(body.difficulty);
    const language = parseLanguage(body.language);
    const cfg = resolveRequestConfig(req.headers);

    const response = await chatCompletion(
      cfg,
      [
        { role: 'system', content: systemPrompt('quiz', language) },
        { role: 'user', content: `Generate a quiz about: ${topic}\nQuestions: ${count}\nDifficulty: ${difficulty}\n${languageReminder(language)}` },
      ],
      { temperature: 0.5, maxTokens: capMaxTokens() },
    );

    const quiz = parseQuiz(response.content, topic);
    if (quiz.questions.length === 0) {
      throw new LLMError(
        'unparseable_output',
        'The model did not return a quiz in the expected format. Try again or pick a stronger model.',
        502,
      );
    }

    return Response.json({
      title: quiz.title,
      questions: quiz.questions.slice(0, count),
      usage: response.usage,
      model: response.model,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
