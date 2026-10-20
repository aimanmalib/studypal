"use client";

import { useStore } from '@/lib/store';
import { PROVIDER_PRESETS } from '@/lib/providers';
import { ApiError } from '@/lib/client/request';
import { AlertIcon, KeyIcon } from './icons';

export interface UiError {
  message: string;
  needsSettings: boolean;
}

/** Convert anything thrown by the request helpers into a message for the UI. */
export function toUiError(err: unknown): UiError {
  if (err instanceof ApiError) {
    return { message: err.message, needsSettings: err.needsSettings };
  }
  return { message: 'Something went wrong. Please try again.', needsSettings: false };
}

/** Open Settings automatically when the fix is there (missing or rejected key...). */
export function useErrorHandler() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  return (err: unknown): UiError => {
    const ui = toUiError(err);
    if (err instanceof ApiError && err.code === 'missing_key') setSettingsOpen(true);
    return ui;
  };
}

export function ErrorNotice({ error, className = '' }: { error: UiError; className?: string }) {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 rounded-xl border border-red-900/70 bg-red-950/40 p-4 text-sm text-red-200 sm:flex-row sm:items-center ${className}`}
    >
      <div className="flex flex-1 gap-2">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <p>{error.message}</p>
      </div>
      {error.needsSettings && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="self-start rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-900/50 sm:self-auto"
        >
          Open Settings
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

  if (!settingsLoaded || !serverInfo || serverInfo.mode !== 'byok') return null;
  if (settings && (settings.apiKey || !PROVIDER_PRESETS[settings.provider].requiresKey)) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2 text-slate-200">
        <KeyIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
        <p>
          StudyPal runs on <strong>your own API key</strong> here (OpenAI, OpenRouter, Groq and more). It stays in your
          browser and is never stored on the server.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 sm:self-auto"
      >
        Add API key
      </button>
    </div>
  );
}
