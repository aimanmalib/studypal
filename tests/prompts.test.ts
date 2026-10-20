/** @jest-environment node */

import { SYSTEM_PROMPTS } from '../src/lib/prompts';

describe('system prompts', () => {
  it('has a prompt for every feature that has an API route', () => {
    expect(Object.keys(SYSTEM_PROMPTS).sort()).toEqual(['chat', 'flashcards', 'quiz', 'summarize']);
  });

  it('names the assistant StudyPal in chat', () => {
    expect(SYSTEM_PROMPTS.chat).toContain('StudyPal');
  });

  it('asks for the JSON shapes the parsers expect', () => {
    for (const field of ['"front"', '"back"', '"difficulty"', '"tags"']) {
      expect(SYSTEM_PROMPTS.flashcards).toContain(field);
    }
    for (const field of ['"title"', '"questions"', '"options"', '"correct"', '"explanation"']) {
      expect(SYSTEM_PROMPTS.quiz).toContain(field);
    }
  });

  it('asks for exactly the requested number of items', () => {
    expect(SYSTEM_PROMPTS.flashcards).toContain('exactly the number of cards requested');
    expect(SYSTEM_PROMPTS.quiz).toContain('exactly the number of questions requested');
  });

  it('uses the Feynman technique for summaries', () => {
    expect(SYSTEM_PROMPTS.summarize).toContain('Feynman');
  });
});
