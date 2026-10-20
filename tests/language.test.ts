/** @jest-environment node */

import { parseAcceptLanguage, parseLanguage, pickLanguage } from '../src/lib/language';
import { languageInstruction, languageReminder, systemPrompt } from '../src/lib/prompts';

describe('language detection', () => {
  it('picks Bahasa Melayu for Malay browser languages', () => {
    expect(pickLanguage(['ms-MY', 'en-US'])).toBe('ms');
    expect(pickLanguage(['ms'])).toBe('ms');
    expect(pickLanguage(['en-GB', 'ms'])).toBe('en');
  });

  it('skips unsupported languages and defaults to English', () => {
    expect(pickLanguage(['zh-CN', 'ms-MY'])).toBe('ms');
    expect(pickLanguage(['id-ID'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage(undefined)).toBe('en');
  });

  it('orders Accept-Language by q-value', () => {
    expect(parseAcceptLanguage('en;q=0.5, ms-MY;q=0.9, zh')).toEqual(['zh', 'ms-MY', 'en']);
    expect(pickLanguage(parseAcceptLanguage('en;q=0.5, ms-MY;q=0.9'))).toBe('ms');
    expect(parseAcceptLanguage(null)).toEqual([]);
  });

  it('accepts only known languages from API bodies', () => {
    expect(parseLanguage('ms')).toBe('ms');
    expect(parseLanguage('ms-MY')).toBe('ms');
    expect(parseLanguage('en')).toBe('en');
    expect(parseLanguage('id')).toBe('en');
    expect(parseLanguage(42)).toBe('en');
    expect(parseLanguage(undefined)).toBe('en');
  });
});

describe('language instructions for the model', () => {
  it('asks for Malaysian Malay and names the Indonesian words to avoid', () => {
    const ms = languageInstruction('ms');
    expect(ms).toContain('Malaysian Bahasa Melayu');
    expect(ms).toContain('Do not write Indonesian');
    for (const word of ['kirim', 'unduh', 'saat', 'karena', 'harus']) expect(ms).toContain(`"${word}"`);
  });

  it('adds the language rule to every feature prompt', () => {
    for (const feature of ['chat', 'flashcards', 'quiz', 'summarize'] as const) {
      expect(systemPrompt(feature, 'ms')).toContain(languageInstruction('ms'));
      expect(systemPrompt(feature, 'en')).toContain(languageInstruction('en'));
    }
  });

  it('keeps JSON structure in English for the JSON features only', () => {
    expect(systemPrompt('quiz', 'ms')).toContain('option letters (A, B, C, D)');
    expect(systemPrompt('flashcards', 'ms')).toContain('difficulty values (easy, medium, hard)');
    expect(systemPrompt('chat', 'ms')).not.toContain('JSON keys');
  });

  it('asks for plain-text formulas, since the UI does not render LaTeX', () => {
    for (const feature of ['chat', 'flashcards', 'quiz', 'summarize'] as const) {
      expect(systemPrompt(feature, 'en')).toContain('do not use LaTeX');
    }
  });

  it('has a short reminder for the user turn', () => {
    expect(languageReminder('ms')).toMatch(/Bahasa Melayu \(not Indonesian\)/);
    expect(languageReminder('en')).toBe('Write the text in English.');
  });
});
