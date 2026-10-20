"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { PROVIDER_PRESETS } from '@/lib/providers';
import type { PublicServerInfo } from '@/lib/llm-config';
import { KeyIcon } from './icons';
import SettingsDialog from './SettingsDialog';

const LINKS = [
  { href: '/', label: 'Chat' },
  { href: '/flashcards', label: 'Flashcards', short: 'Cards' },
  { href: '/quiz', label: 'Quiz' },
  { href: '/summarize', label: 'Summarize', short: 'Summary' },
  { href: '/dashboard', label: 'Stats' },
];

/** Loads settings + server mode once, and renders the navigation bar. */
export default function AppShell() {
  const pathname = usePathname();
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
    ? serverInfo?.providerLabel ?? 'Server'
    : settings && hasKey
      ? PROVIDER_PRESETS[settings.provider].label
      : 'Add API key';

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-400 text-sm font-bold text-slate-950">
              SP
            </span>
            <span className="text-lg font-semibold">StudyPal</span>
          </Link>

          <div className="hidden items-center gap-1 text-sm md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 transition ${
                  isActive(l.href) ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-brand-500"
            aria-label={`Settings: ${status === 'missing' ? 'no API key yet' : statusLabel}`}
          >
            <KeyIcon className="h-4 w-4 shrink-0 text-brand-400" />
            <span className="max-w-[9rem] truncate">{status === 'loading' ? 'Settings' : statusLabel}</span>
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${
                status === 'ok' ? 'bg-emerald-400' : status === 'missing' ? 'bg-amber-400' : 'bg-slate-600'
              }`}
            />
          </button>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-5 border-t border-slate-800/80 px-2 text-xs md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className={`py-2.5 text-center transition ${
                isActive(l.href) ? 'font-medium text-brand-400' : 'text-slate-400'
              }`}
            >
              {l.short ?? l.label}
            </Link>
          ))}
        </div>
      </nav>
      <SettingsDialog />
    </>
  );
}
