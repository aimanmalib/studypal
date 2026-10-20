"use client";

import { CircleAlert, KeyRound, LoaderCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PROVIDER_PRESETS } from '@/lib/providers';
import { ApiError } from '@/lib/client/request';
import { useI18n } from '@/i18n/I18nProvider';
import { Translate, hasMessage } from '@/i18n';
import { rich } from '@/i18n/rich';

export interface UiError {
  message: string;
  needsSettings: boolean;
}

/**
 * Convert anything thrown by the request helpers into a message for the UI,
 * in the interface language. The server's English message is only a fallback
 * for codes the language files do not know.
 */
export function toUiError(err: unknown, t?: Translate): UiError {
  if (err instanceof ApiError) {
    const key = `error.${err.code}`;
    const message = t && hasMessage(key) ? t(key) : err.message;
    return { message, needsSettings: err.needsSettings };
  }
  return { message: t ? t('error.generic') : 'Something went wrong. Please try again.', needsSettings: false };
}

/** Open Settings automatically when the fix is there (missing or rejected key...). */
export function useErrorHandler() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const { t } = useI18n();
  return (err: unknown): UiError => {
    const ui = toUiError(err, t);
    if (err instanceof ApiError && err.code === 'missing_key') setSettingsOpen(true);
    return ui;
  };
}

export function ErrorNotice({ error, className = '' }: { error: UiError; className?: string }) {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-fg sm:flex-row sm:items-center ${className}`}
    >
      <div className="flex flex-1 gap-2.5">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{error.message}</p>
      </div>
      {error.needsSettings && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="min-h-11 self-start rounded-lg border border-danger-line px-4 text-sm font-medium transition hover:bg-danger-soft sm:self-auto"
        >
          {t('notice.openSettings')}
        </button>
      )}
    </div>
  );
}

/** Shown in bring-your-own-key mode until the visitor adds a key. */
export function KeyNotice() {
  const settings = useStore((s) => s.settings);
  const settingsLoaded = useStore((s) => s.settingsLoaded);
  const serverInfo = useStore((s) => s.serverInfo);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const { t } = useI18n();

  if (!settingsLoaded || !serverInfo || serverInfo.mode !== 'byok') return null;
  if (settings && (settings.apiKey || !PROVIDER_PRESETS[settings.provider].requiresKey)) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-accent-line bg-accent-soft p-4 text-sm sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true" />
        <p>{rich(t('notice.byok'), { own: <strong className="font-semibold">{t('notice.ownKey')}</strong> })}</p>
      </div>
      <button type="button" onClick={() => setSettingsOpen(true)} className="btn-primary self-start px-4 text-sm sm:self-auto">
        {t('notice.addKey')}
      </button>
    </div>
  );
}

/** Page heading with an optional one-line intro. */
export function PageHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {intro && <p className="mt-1.5 text-sm text-muted">{intro}</p>}
    </header>
  );
}

/** Calm empty state: one icon, one title, one sentence. */
export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-fg">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mb-1 font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{body}</p>
    </div>
  );
}

/** Loading placeholder for generated content (flashcards, quiz). */
export function LoadingPanel({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="card p-6">
      <div className="mb-5 flex items-center gap-2.5 text-sm text-muted">
        <LoaderCircle className="h-4 w-4 shrink-0 text-accent-fg motion-safe:animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="space-y-3 motion-safe:animate-pulse" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-3 rounded-full bg-surface-2" style={{ width: `${92 - i * 17}%` }} />
        ))}
      </div>
    </div>
  );
}
