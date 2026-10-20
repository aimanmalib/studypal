"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { KeyRound } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PROVIDER_PRESETS } from '@/lib/providers';
import type { PublicServerInfo } from '@/lib/llm-config';
import { LANGUAGES } from '@/lib/language';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n';
import SettingsDialog from './SettingsDialog';
import ThemeToggle from './ThemeToggle';

const LINKS: { href: string; label: MessageKey; short?: MessageKey }[] = [
  { href: '/', label: 'nav.chat' },
  { href: '/flashcards', label: 'nav.flashcards', short: 'nav.flashcardsShort' },
  { href: '/quiz', label: 'nav.quiz' },
  { href: '/summarize', label: 'nav.summarize', short: 'nav.summarizeShort' },
  { href: '/dashboard', label: 'nav.stats' },
];

function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div role="group" aria-label={t('language.label')} className="flex h-11 shrink-0 rounded-xl border border-line p-0.5">
      {LANGUAGES.map((lang) => {
        const active = lang === language;
        return (
          <button
            key={lang}
            type="button"
            lang={lang}
            onClick={() => setLanguage(lang)}
            aria-pressed={active}
            aria-label={t(`language.${lang}`)}
            title={t(`language.${lang}`)}
            className={`min-w-10 rounded-[0.6rem] px-2 text-xs font-semibold tracking-wide transition ${
              active ? 'bg-accent-soft text-accent-fg-strong ring-1 ring-accent-line' : 'text-muted hover:text-fg'
            }`}
          >
            {t(`language.${lang}Short`)}
          </button>
        );
      })}
    </div>
  );
}

/** Loads settings + server mode once, and renders the navigation bar. */
export default function AppShell() {
  const pathname = usePathname();
  const { t } = useI18n();
  const settings = useStore((s) => s.settings);
  const settingsLoaded = useStore((s) => s.settingsLoaded);
  const serverInfo = useStore((s) => s.serverInfo);
  const loadStoredSettings = useStore((s) => s.loadStoredSettings);
  const setServerInfo = useStore((s) => s.setServerInfo);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  useEffect(() => {
    loadStoredSettings();
    let cancelled = false;
    fetch('/api/config', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<PublicServerInfo>) : null))
      .catch(() => null)
      .then((info) => {
        // If the probe fails, assume bring-your-own-key: the API routes still
        // answer with a clear error when something is missing.
        if (!cancelled) setServerInfo(info ?? { mode: 'byok', allowCustomBaseUrl: false, maxTokens: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [loadStoredSettings, setServerInfo]);

  const serverMode = serverInfo?.mode === 'server';
  const ready = settingsLoaded && serverInfo !== null;
  const hasKey = Boolean(settings?.apiKey) || (settings ? !PROVIDER_PRESETS[settings.provider].requiresKey : false);
  const status = !ready ? 'loading' : serverMode || hasKey ? 'ok' : 'missing';
  const statusLabel = serverMode
    ? serverInfo?.providerLabel ?? t('header.server')
    : settings && hasKey
      ? PROVIDER_PRESETS[settings.provider].label
      : t('header.addKey');

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <nav aria-label={t('nav.label')} className="sticky top-0 z-50 border-b border-line bg-bg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
          <Link href="/" aria-label={t('nav.home')} className="-ml-1 flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-1">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-400 text-sm font-bold text-slate-950"
            >
              SP
            </span>
            <span className="text-lg font-semibold tracking-tight max-[359px]:hidden">StudyPal</span>
          </Link>

          <div className="hidden items-center gap-1 text-sm md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`flex min-h-10 items-center rounded-xl px-3.5 font-medium transition ${
                  isActive(l.href) ? 'bg-surface text-fg shadow-[var(--shadow-card)]' : 'text-muted hover:text-fg'
                }`}
              >
                {t(l.label)}
              </Link>
            ))}
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            <LanguageSwitch />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-11 min-w-11 shrink items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-fg transition hover:border-accent-line"
              aria-label={t('header.settingsAria', { status: status === 'missing' ? t('header.noKey') : statusLabel })}
            >
              <KeyRound className="h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true" />
              <span className="hidden max-w-[9rem] truncate sm:inline">
                {status === 'loading' ? t('header.settings') : statusLabel}
              </span>
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  status === 'ok' ? 'bg-dot-ok' : status === 'missing' ? 'bg-dot-warn' : 'bg-line-field'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-5 border-t border-line px-1 md:hidden">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-11 items-center justify-center px-0.5 text-center text-xs leading-tight transition ${
                  active ? 'font-semibold text-accent-fg' : 'text-muted'
                }`}
              >
                {t(l.short ?? l.label)}
                {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent-fg" />}
              </Link>
            );
          })}
        </div>
      </nav>
      <SettingsDialog />
    </>
  );
}
