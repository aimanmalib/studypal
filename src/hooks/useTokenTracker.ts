"use client";

import { useStore, type UsageStats } from '@/lib/store';

export interface TokenStats extends UsageStats {
  avgPerCall: number;
  /** Share of prompt tokens the provider served from its cache (0 when not reported). */
  cacheHitRate: number;
}

export function computeTokenStats(usage: UsageStats): TokenStats {
  return {
    ...usage,
    avgPerCall: usage.calls > 0 ? Math.round(usage.totalTokens / usage.calls) : 0,
    cacheHitRate: usage.promptTokens > 0 ? usage.cachedTokens / usage.promptTokens : 0,
  };
}

/**
 * Token usage reported by the provider for this browser session. Shared by
 * every page through the app store; it resets on a full page reload.
 */
export function useTokenTracker() {
  const usage = useStore((s) => s.usage);
  const track = useStore((s) => s.trackUsage);
  const reset = useStore((s) => s.resetUsage);
  return { stats: computeTokenStats(usage), track, reset };
}
