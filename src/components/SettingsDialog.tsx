"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { PROVIDER_IDS, PROVIDER_PRESETS, ProviderId, isValidModel } from '@/lib/providers';
import { LLMSettings, defaultSettings, maskKey } from '@/lib/client/settings';
import { Eye, EyeOff, ShieldCheck, Trash2, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { rich } from '@/i18n/rich';

const inputClass = 'field w-full px-3 py-2.5 text-base sm:text-sm';

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
  const { t } = useI18n();

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
      setError(t('settings.errorModel'));
      return;
    }
    if (preset.requiresKey && !draft.apiKey.trim() && !draft.baseUrl.trim()) {
      setError(t('settings.errorKey', { provider: preset.label }));
      return;
    }
    if (preset.local && !allowCustom) {
      setError(t('settings.errorLocal', { provider: preset.label }));
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
    setNotice(t('settings.keyRemoved'));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface text-fg shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {t('settings.title')}
            </h2>
            <p className="text-sm text-muted">{t('settings.subtitle')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="icon-btn -mt-1 -mr-2"
            aria-label={t('settings.close')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {serverMode ? (
          <div className="space-y-4 overflow-y-auto px-5 py-5 text-sm">
            <p>{t('settings.serverIntro')}</p>
            <dl className="divide-y divide-line rounded-xl border border-line bg-inset">
              <Row label={t('settings.provider')} value={serverInfo?.providerLabel ?? '—'} />
              <Row label={t('settings.model')} value={serverInfo?.model ?? '—'} />
              <Row
                label={t('settings.endpoint')}
                value={
                  serverInfo?.endpointHost === 'custom endpoint'
                    ? t('stats.customEndpoint')
                    : (serverInfo?.endpointHost ?? '—')
                }
              />
            </dl>
            {serverInfo?.error && <p className="text-danger-fg">{t('error.server_misconfigured')}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary px-5"
              >
                {t('settings.done')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="flex min-h-0 flex-col">
            <div className="space-y-5 overflow-y-auto px-5 py-5">
              <Field label={t('settings.provider')} htmlFor="sp-provider">
                <select
                  id="sp-provider"
                  ref={firstFieldRef}
                  value={draft.provider}
                  onChange={(e) => changeProvider(e.target.value as ProviderId)}
                  className={`${inputClass} select-field pr-9`}
                >
                  {PROVIDER_IDS.map((id) => {
                    const p = PROVIDER_PRESETS[id];
                    const disabled = p.local && !allowCustom;
                    return (
                      <option key={id} value={id} disabled={disabled}>
                        {p.label}
                        {disabled ? t('settings.selfHostOnly') : ''}
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Field
                label={t('settings.model')}
                htmlFor="sp-model"
                hint={
                  <>
                    {t('settings.modelDefault', { provider: preset.label })}{' '}
                    <code className="font-mono text-fg">{preset.defaultModel}</code>
                    {draft.model.trim() !== preset.defaultModel && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="font-medium text-accent-fg underline underline-offset-2"
                          onClick={() => setDraft((d) => ({ ...d, model: preset.defaultModel }))}
                        >
                          {t('settings.useDefault')}
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
                label={preset.requiresKey ? t('settings.apiKey') : t('settings.apiKeyOptional')}
                htmlFor="sp-key"
                hint={
                  saved?.apiKey && saved.provider === draft.provider ? (
                    <>{t('settings.savedKey', { key: maskKey(saved.apiKey) })}</>
                  ) : 'keyUrl' in preset && preset.keyUrl ? (
                    <>
                      {t('settings.getKeyAt')}{' '}
                      <a
                        href={preset.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent-fg underline underline-offset-2"
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
                    placeholder={t('settings.keyPlaceholder')}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`${inputClass} pr-11 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted hover:text-fg"
                    aria-label={showKey ? t('settings.hideKey') : t('settings.showKey')}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              {allowCustom && (
                <Field
                  label={t('settings.customEndpoint')}
                  htmlFor="sp-base"
                  hint={t('settings.customEndpointHint')}
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

              <div className="flex gap-3 rounded-xl border border-line bg-inset p-3 text-sm text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" aria-hidden="true" />
                <p>
                  {rich(t('settings.privacy'), {
                    provider: preset.label,
                    forget: <span className="font-medium text-fg">{t('settings.forget')}</span>,
                  })}
                </p>
              </div>

              {!persisted && (
                <p className="text-sm text-warn-fg">{t('settings.storageBlocked')}</p>
              )}
              {notice && (
                <p role="status" className="text-sm text-success-fg">
                  {notice}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger-fg">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={forget}
                disabled={!saved?.apiKey && !draft.apiKey}
                className="-ml-3 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-danger-fg transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('settings.forget')}
              </button>
              <button
                type="submit"
                className="btn-primary px-6 text-sm"
              >
                {t('settings.save')}
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
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-mono text-xs text-accent-fg-strong">{value}</dd>
    </div>
  );
}
