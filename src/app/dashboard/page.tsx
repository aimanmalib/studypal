"use client";

import { useStore } from '@/lib/store';
import { PROVIDER_PRESETS } from '@/lib/providers';
import { useTokenTracker } from '@/hooks/useTokenTracker';

export default function DashboardPage() {
  const { stats, reset } = useTokenTracker();
  const settings = useStore((s) => s.settings);
  const settingsLoaded = useStore((s) => s.settingsLoaded);
  const serverInfo = useStore((s) => s.serverInfo);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const serverMode = serverInfo?.mode === 'server';
  const loading = !settingsLoaded || !serverInfo;
  const preset = settings ? PROVIDER_PRESETS[settings.provider] : null;

  let rows: { label: string; value: string }[];
  if (loading) {
    rows = [{ label: 'Provider', value: 'Loading…' }];
  } else if (serverMode) {
    rows = [
      { label: 'Mode', value: 'Server key (self-hosted)' },
      { label: 'Provider', value: serverInfo.providerLabel ?? '—' },
      { label: 'Model', value: serverInfo.model ?? '—' },
      { label: 'Endpoint', value: serverInfo.endpointHost ?? '—' },
      { label: 'Auth header', value: serverInfo.authStyle === 'api-key' ? 'api-key' : 'Authorization: Bearer' },
    ];
  } else if (settings && preset) {
    const endpoint = settings.baseUrl ? safeHost(settings.baseUrl) : safeHost(preset.baseUrl);
    rows = [
      { label: 'Mode', value: 'Your own key (this browser)' },
      { label: 'Provider', value: preset.label },
      { label: 'Model', value: settings.model || preset.defaultModel },
      { label: 'Endpoint', value: endpoint },
      { label: 'Auth header', value: preset.authStyle === 'api-key' ? 'api-key' : 'Authorization: Bearer' },
      { label: 'API key', value: settings.apiKey ? 'Saved in this browser' : 'Not set' },
    ];
  } else {
    rows = [
      { label: 'Mode', value: 'Your own key (this browser)' },
      { label: 'Provider', value: 'Not set up yet' },
    ];
  }
  if (!loading && serverInfo?.maxTokens) {
    rows.push({ label: 'Max tokens per answer', value: serverInfo.maxTokens.toLocaleString() });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Stats</h1>
      <p className="mb-6 text-sm text-slate-400">
        Token usage reported by your provider in this browser tab. It resets when you reload the page.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:gap-4">
        {[
          { label: 'Total tokens', value: stats.totalTokens.toLocaleString() },
          { label: 'Requests', value: stats.calls.toString() },
          { label: 'Avg per request', value: stats.avgPerCall.toLocaleString() },
          { label: 'Cached prompt tokens', value: `${(stats.cacheHitRate * 100).toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
            <div className="text-2xl font-bold text-brand-400">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <div className="mb-8 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Chat and summaries are counted only when the provider includes usage in its stream.</p>
        <button type="button" onClick={reset} className="self-start text-brand-400 hover:underline sm:self-auto">
          Reset
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Provider</h2>
          {!serverMode && !loading && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 transition hover:border-brand-500"
            >
              Change in Settings
            </button>
          )}
        </div>
        <dl className="space-y-2 text-sm">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-400">{label}</dt>
              <dd className="min-w-0 truncate text-right text-brand-300">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
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
