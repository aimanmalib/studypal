"use client";

import { Settings2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PROVIDER_PRESETS } from '@/lib/providers';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { PageHeader } from '@/components/Notices';
import { useI18n } from '@/i18n/I18nProvider';

export default function DashboardPage() {
  const { stats, reset } = useTokenTracker();
  const { t, formatNumber } = useI18n();
  const settings = useStore((s) => s.settings);
  const settingsLoaded = useStore((s) => s.settingsLoaded);
  const serverInfo = useStore((s) => s.serverInfo);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const serverMode = serverInfo?.mode === 'server';
  const loading = !settingsLoaded || !serverInfo;
  const preset = settings ? PROVIDER_PRESETS[settings.provider] : null;
  const bearer = 'Authorization: Bearer';

  let rows: { label: string; value: string }[];
  if (loading) {
    rows = [{ label: t('stats.rowProvider'), value: t('common.loading') }];
  } else if (serverMode) {
    const host = serverInfo.endpointHost;
    rows = [
      { label: t('stats.rowMode'), value: t('stats.modeServer') },
      { label: t('stats.rowProvider'), value: serverInfo.providerLabel ?? '—' },
      { label: t('stats.rowModel'), value: serverInfo.model ?? '—' },
      { label: t('stats.rowEndpoint'), value: host === 'custom endpoint' ? t('stats.customEndpoint') : (host ?? '—') },
      { label: t('stats.rowAuth'), value: serverInfo.authStyle === 'api-key' ? 'api-key' : bearer },
    ];
  } else if (settings && preset) {
    const endpoint = settings.baseUrl ? safeHost(settings.baseUrl) : safeHost(preset.baseUrl);
    rows = [
      { label: t('stats.rowMode'), value: t('stats.modeByok') },
      { label: t('stats.rowProvider'), value: preset.label },
      { label: t('stats.rowModel'), value: settings.model || preset.defaultModel },
      { label: t('stats.rowEndpoint'), value: endpoint },
      { label: t('stats.rowAuth'), value: preset.authStyle === 'api-key' ? 'api-key' : bearer },
      { label: t('stats.rowKey'), value: settings.apiKey ? t('stats.keySaved') : t('stats.keyNotSet') },
    ];
  } else {
    rows = [
      { label: t('stats.rowMode'), value: t('stats.modeByok') },
      { label: t('stats.rowProvider'), value: t('stats.notSetUp') },
    ];
  }
  if (!loading && serverInfo?.maxTokens) {
    rows.push({ label: t('stats.rowMaxTokens'), value: formatNumber(serverInfo.maxTokens) });
  }

  const tiles = [
    { label: t('stats.totalTokens'), value: formatNumber(stats.totalTokens) },
    { label: t('stats.requests'), value: formatNumber(stats.calls) },
    { label: t('stats.avg'), value: formatNumber(stats.avgPerCall) },
    { label: t('stats.cached'), value: `${formatNumber(Number((stats.cacheHitRate * 100).toFixed(1)))}%` },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('stats.title')} intro={t('stats.intro')} />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:gap-4">
        {tiles.map(({ label, value }) => (
          <div key={label} className="card p-4 sm:p-6">
            <div className="text-2xl font-bold text-accent-fg tabular-nums sm:text-3xl">{value}</div>
            <div className="mt-1 text-sm text-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="mb-8 flex flex-col gap-1 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p>{t('stats.streamNote')}</p>
        <button
          type="button"
          onClick={reset}
          className="-mx-2 min-h-11 self-start rounded-lg px-2 font-medium text-accent-fg hover:underline sm:self-auto"
        >
          {t('stats.reset')}
        </button>
      </div>

      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{t('stats.provider')}</h2>
          {!serverMode && !loading && (
            <button type="button" onClick={() => setSettingsOpen(true)} className="btn-secondary px-3 text-sm">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              {t('stats.change')}
            </button>
          )}
        </div>
        <dl className="divide-y divide-line text-sm">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-muted">{label}</dt>
              <dd className="min-w-0 truncate text-right font-medium text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
