"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
  Language,
  isLanguage,
  pickLanguage,
} from '@/lib/language';
import { NUMBER_LOCALE, Translate, translate } from './index';

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
  formatNumber: (n: number) => string;
}

function makeValue(language: Language, setLanguage: (l: Language) => void): I18nValue {
  const numbers = new Intl.NumberFormat(NUMBER_LOCALE[language]);
  return {
    language,
    setLanguage,
    t: (key, vars) => translate(language, key, vars),
    formatNumber: (n) => numbers.format(n),
  };
}

// Without a provider (unit tests, isolated renders) the UI is English.
const I18nContext = createContext<I18nValue>(makeValue(DEFAULT_LANGUAGE, () => undefined));

function readStoredLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    // Blocked storage (private mode, disabled site data) throws on access.
    return null;
  }
}

function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The choice still applies to this tab, and the cookie below may persist it.
  }
}

/** Lets the server render the chosen language on the next visit (no flash of English). */
function writeLanguageCookie(language: Language): void {
  try {
    document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Cookies disabled: localStorage (or the browser language) still decides.
  }
}

/** The visitor's choice in this tab, and who to tell when it changes. */
function createChoice() {
  let chosen: Language | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => chosen,
    set(language: Language) {
      chosen = language;
      listeners.forEach((notify) => notify());
    },
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

/**
 * Provides the interface language.
 *
 * The server renders `initialLanguage` (from the cookie, or else the browser's
 * Accept-Language). In the browser the order is: the choice made in this tab,
 * localStorage, the cookie the server saw, then `navigator.languages`.
 * useSyncExternalStore hydrates with the server value and then switches, so
 * there is no hydration mismatch.
 */
export function I18nProvider({
  initialLanguage,
  fromCookie,
  children,
}: {
  initialLanguage: Language;
  fromCookie: boolean;
  children: React.ReactNode;
}) {
  const [choice] = useState(createChoice);
  const language = useSyncExternalStore<Language>(
    choice.subscribe,
    () => choice.get() ?? readStoredLanguage() ?? (fromCookie ? initialLanguage : pickLanguage(navigator.languages)),
    () => initialLanguage,
  );

  useEffect(() => {
    document.documentElement.lang = language;
    // Keep the cookie in step with a saved choice so the next server render matches it.
    const savedChoice = readStoredLanguage() === language;
    if (savedChoice && !(fromCookie && language === initialLanguage)) writeLanguageCookie(language);
  }, [language, fromCookie, initialLanguage]);

  const setLanguage = useCallback(
    (next: Language) => {
      storeLanguage(next);
      writeLanguageCookie(next);
      choice.set(next);
    },
    [choice],
  );

  const value = useMemo(() => makeValue(language, setLanguage), [language, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
