/**
 * Languages StudyPal speaks. Shared by the UI (interface text) and the API
 * routes (the language the model must answer in). Safe on server and client.
 */

export const LANGUAGES = ['en', 'ms'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

/** localStorage key (source of truth in the browser) and cookie name (lets the server render the right language). */
export const LANGUAGE_STORAGE_KEY = 'studypal.language';
export const LANGUAGE_COOKIE = 'studypal_lang';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Map one BCP 47 tag ("ms-MY", "en-GB", "ms") to a supported language, or null. */
export function languageFromTag(tag: string): Language | null {
  const primary = tag.trim().toLowerCase().split(/[-_;]/)[0];
  return isLanguage(primary) ? primary : null;
}

/**
 * Pick the first supported language from the visitor's preferences, in their
 * order (`navigator.languages` or the tags of an Accept-Language header).
 * Malay ("ms", "ms-MY", ...) means Bahasa Melayu; anything else falls back to English.
 */
export function pickLanguage(preferred: readonly string[] | undefined | null): Language {
  for (const tag of preferred ?? []) {
    const lang = languageFromTag(tag);
    if (lang) return lang;
  }
  return DEFAULT_LANGUAGE;
}

/** Parse an Accept-Language header in q-value order. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((x) => x.tag);
}

/** Validate the `language` field of an API request body. Anything unknown means English. */
export function parseLanguage(value: unknown): Language {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  return languageFromTag(value) ?? DEFAULT_LANGUAGE;
}
