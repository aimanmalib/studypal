"use client";

import { useState, useCallback, useRef } from 'react';

export interface TokenStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  calls: number;
  avgPerCall: number;
  cacheHitRate: number;
}

export function useTokenTracker() {
  const [stats, setStats] = useState<TokenStats>({
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    calls: 0,
    avgPerCall: 0,
    cacheHitRate: 0,
  });

  const sessionStart = useRef(Date.now());

  const track = useCallback((usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens?: number;
  }) => {
    setStats(prev => {
      const newPrompt = prev.promptTokens + usage.prompt_tokens;
      const newCompletion = prev.completionTokens + usage.completion_tokens;
      const newTotal = prev.totalTokens + usage.total_tokens;
      const newCached = prev.cachedTokens + (usage.cached_tokens || 0);
      const newCalls = prev.calls + 1;

      return {
        totalTokens: newTotal,
        promptTokens: newPrompt,
        completionTokens: newCompletion,
        cachedTokens: newCached,
        calls: newCalls,
        avgPerCall: Math.round(newTotal / newCalls),
        cacheHitRate: newPrompt > 0 ? newCached / newPrompt : 0,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setStats({
      totalTokens: 0, promptTokens: 0, completionTokens: 0,
      cachedTokens: 0, calls: 0, avgPerCall: 0, cacheHitRate: 0,
    });
    sessionStart.current = Date.now();
  }, []);

  return { stats, track, reset, sessionStart: sessionStart.current };
}
