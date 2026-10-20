/**
 * Interface text for every supported language. The text itself lives in the
 * JSON files next to this one (one file per language, same keys); components
 * only ever refer to keys. `tests/i18n.test.ts` fails when a key, or a
 * `{placeholder}`, is missing from either file.
 */

import type { Language } from '@/lib/language';
import en from './en.json';
import ms from './ms.json';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Vars = Record<string, string | number>;

export const MESSAGES: Record<Language, Messages> = { en, ms };

/** Intl locale used for numbers in each language. */
export const NUMBER_LOCALE: Record<Language, string> = { en: 'en-US', ms: 'ms-MY' };

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Look up a key; falls back to English, then to the key itself, so the UI never shows `undefined`. */
export function translate(language: Language, key: MessageKey, vars?: Vars): string {
  const template = MESSAGES[language][key] ?? MESSAGES.en[key] ?? key;
  return interpolate(template, vars);
}

export function hasMessage(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(MESSAGES.en, key);
}

export type Translate = (key: MessageKey, vars?: Vars) => string;
