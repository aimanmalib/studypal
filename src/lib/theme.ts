/**
 * Light / dark theme. The visitor's explicit choice is kept in localStorage;
 * without one, the operating system's `prefers-color-scheme` decides. The
 * resolved theme is written to `<html data-theme>` (colours live in
 * globals.css as tokens) before the first paint by THEME_INIT_SCRIPT.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'studypal.theme';
export const THEME_EVENT = 'studypal:theme';

/** Inline <head> script: applies the theme before paint so there is no flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,t=null;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}d.dataset.theme=t;d.style.colorScheme=t}catch(e){}})();`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function storedTheme(): Theme | null {
  try {
    const t = window.localStorage.getItem(THEME_STORAGE_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Explicit choice from the toggle: apply and remember it. */
export function chooseTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Applies to this tab only when storage is blocked.
  }
}
