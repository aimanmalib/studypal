"use client";

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { THEME_EVENT, Theme, applyTheme, chooseTheme, currentTheme, storedTheme } from '@/lib/theme';

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export default function ThemeToggle() {
  const { t } = useI18n();
  // The server cannot know the theme; it renders the dark state and React
  // re-renders with the real one after hydration.
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => 'dark');

  // Follow the operating system while the visitor has not chosen explicitly.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onSystemChange = () => {
      if (!storedTheme()) applyTheme(media.matches ? 'light' : 'dark');
    };
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? t('theme.toLight') : t('theme.toDark');

  return (
    <button type="button" onClick={() => chooseTheme(next)} className="icon-btn" aria-label={label} title={label}>
      {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
