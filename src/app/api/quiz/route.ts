import { chatCompletion, trackUsage } from '@/lib/mimo';
import { SYSTEM_PROMPTS } from '@/lib/prompts';

export async function POST(req: Request) {
  try {
    const { topic, count = 5, difficulty = 'mixed' } = await req.json();

    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPTS.quiz },
      {
        role: 'user',
        content: `Generate a quiz about: ${topic}\nQuestions: ${count}\nDifficulty: ${difficulty}`,
      },
    ], { temperature: 0.5, max_tokens: 2048 });

    trackUsage(response.usage);

    let quiz;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      quiz = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);
    } catch {
      quiz = { title: topic, questions: [] };
    }

    return Response.json({ ...quiz, usage: response.usage });
  } catch (error) {
    return Response.json({ error: 'Failed to generate quiz' }, { status: 500 });
  }
}
