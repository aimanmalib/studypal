"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { PROVIDER_IDS, PROVIDER_PRESETS, ProviderId, isValidModel } from '@/lib/providers';
import { LLMSettings, defaultSettings, maskKey } from '@/lib/client/settings';
import { CloseIcon, EyeIcon, EyeOffIcon, ShieldIcon, TrashIcon } from './icons';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none sm:text-sm';

export default function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  if (!open) return null;
  return <SettingsPanel onClose={() => setOpen(false)} />;
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const saved = useStore((s) => s.settings);
  const persisted = useStore((s) => s.settingsPersisted);
  const serverInfo = useStore((s) => s.serverInfo);
  const updateSettings = useStore((s) => s.updateSettings);
  const forgetKey = useStore((s) => s.forgetKey);

  const [draft, setDraft] = useState<LLMSettings>(() => saved ?? defaultSettings());
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const serverMode = serverInfo?.mode === 'server';
  const allowCustom = Boolean(serverInfo?.allowCustomBaseUrl);
  const preset = PROVIDER_PRESETS[draft.provider];

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (firstFieldRef.current ?? closeRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const changeProvider = (provider: ProviderId) => {
    setDraft((d) => {
      const oldDefault = PROVIDER_PRESETS[d.provider].defaultModel;
      const keepModel = d.model.trim() && d.model.trim() !== oldDefault;
      return { ...d, provider, model: keepModel ? d.model : PROVIDER_PRESETS[provider].defaultModel };
    });
    setNotice(null);
    setError(null);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const model = draft.model.trim() || preset.defaultModel;
    if (!isValidModel(model)) {
      setError('That model name has characters a model id cannot contain.');
      return;
    }
    if (preset.requiresKey && !draft.apiKey.trim() && !draft.baseUrl.trim()) {
      setError(`Paste your ${preset.label} API key to continue.`);
      return;
    }
    if (preset.local && !allowCustom) {
      setError(`${preset.label} only works when you self-host StudyPal.`);
      return;
    }
    const next = { ...draft, model, apiKey: draft.apiKey.trim(), baseUrl: allowCustom ? draft.baseUrl.trim() : '' };
    updateSettings(next);
    setDraft(next);
    setError(null);
    onClose();
  };

  const forget = () => {
    forgetKey();
    setDraft((d) => ({ ...d, apiKey: '' }));
    setError(null);
    setNotice('Key removed from this browser.');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/75" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Settings
            </h2>
            <p className="text-sm text-slate-400">Choose the AI provider StudyPal talks to.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close settings"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {serverMode ? (
          <div className="space-y-4 overflow-y-auto px-5 py-5 text-sm">
            <p className="text-slate-300">
              This StudyPal is set up by its owner with a server-side key, so you do not need your own.
            </p>
            <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/60">
              <Row label="Provider" value={serverInfo?.providerLabel ?? '—'} />
              <Row label="Model" value={serverInfo?.model ?? '—'} />
              <Row label="Endpoint" value={serverInfo?.endpointHost ?? '—'} />
            </dl>
            {serverInfo?.error && <p className="text-red-300">{serverInfo.error}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-500"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <div className="space-y-5 overflow-y-auto px-5 py-5">
              <Field label="Provider" htmlFor="sp-provider">
                <select
                  id="sp-provider"
                  ref={firstFieldRef}
                  value={draft.provider}
                  onChange={(e) => changeProvider(e.target.value as ProviderId)}
                  className={inputClass}
                >
                  {PROVIDER_IDS.map((id) => {
                    const p = PROVIDER_PRESETS[id];
                    const disabled = p.local && !allowCustom;
                    return (
                      <option key={id} value={id} disabled={disabled}>
                        {p.label}
                        {disabled ? ' — self-host only' : ''}
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Field
                label="Model"
                htmlFor="sp-model"
                hint={
                  <>
                    Default for {preset.label}: <code className="text-slate-300">{preset.defaultModel}</code>
                    {draft.model.trim() !== preset.defaultModel && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="text-brand-400 underline-offset-2 hover:underline"
                          onClick={() => setDraft((d) => ({ ...d, model: preset.defaultModel }))}
                        >
                          Use default
                        </button>
                      </>
                    )}
                  </>
                }
              >
                <input
                  id="sp-model"
                  value={draft.model}
                  onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                  placeholder={preset.defaultModel}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputClass}
                />
              </Field>

              <Field
                label={preset.requiresKey ? 'API key' : 'API key (optional)'}
                htmlFor="sp-key"
                hint={
                  saved?.apiKey && saved.provider === draft.provider ? (
                    <>Saved key: {maskKey(saved.apiKey)}</>
                  ) : 'keyUrl' in preset && preset.keyUrl ? (
                    <>
                      Get one at{' '}
                      <a
                        href={preset.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-400 underline-offset-2 hover:underline"
                      >
                        {new URL(preset.keyUrl).host}
                      </a>
                    </>
                  ) : null
                }
              >
                <div className="relative">
                  <input
                    id="sp-key"
                    type={showKey ? 'text' : 'password'}
                    value={draft.apiKey}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, apiKey: e.target.value }));
                      setNotice(null);
                    }}
                    placeholder="Paste your key"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`${inputClass} pr-11 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-white"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>

              {allowCustom && (
                <Field
                  label="Custom endpoint (optional)"
                  htmlFor="sp-base"
                  hint="Any OpenAI-compatible base URL, e.g. http://localhost:11434/v1. Enabled by this server's owner."
                >
                  <input
                    id="sp-base"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                    placeholder={preset.baseUrl}
                    inputMode="url"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={inputClass}
                  />
                </Field>
              )}

              <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  Your key is saved only in this browser. It is sent with each request through this app&apos;s
                  server to {preset.label}, and the server never stores or logs it. Prefer a key with a spending
                  limit, and press <span className="font-medium text-slate-100">Forget key</span> on shared
                  devices.
                </p>
              </div>

              {!persisted && (
                <p className="text-sm text-amber-300">
                  Your browser blocked local storage, so the key only lasts until you close this tab.
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-emerald-300">
                  {notice}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={forget}
                disabled={!saved?.apiKey && !draft.apiKey}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <TrashIcon />
                Forget key
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate font-mono text-xs text-brand-300">{value}</dd>
    </div>
  );
}
