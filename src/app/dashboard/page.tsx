"use client";

import { useTokenTracker } from '@/hooks/useTokenTracker';

export default function DashboardPage() {
  const { stats } = useTokenTracker();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📊 Token Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { label: 'Total Tokens', value: stats.totalTokens.toLocaleString(), icon: '🪙' },
          { label: 'API Calls', value: stats.calls.toString(), icon: '📞' },
          { label: 'Avg/Call', value: stats.avgPerCall.toLocaleString(), icon: '📊' },
          { label: 'Cache Hit Rate', value: `${(stats.cacheHitRate * 100).toFixed(1)}%`, icon: '💾' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-2xl font-bold text-mimo-400">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="font-semibold mb-4">Session Info</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Model</span>
            <span className="text-mimo-400">mimo-v2.5-pro</span>
          </div>
          <div className="flex justify-between">
            <span>API Endpoint</span>
            <span className="text-mimo-400 text-xs">token-plan-sgp.xiaomimimo.com</span>
          </div>
          <div className="flex justify-between">
            <span>Auth Method</span>
            <span className="text-mimo-400">api-key header</span>
          </div>
          <div className="flex justify-between">
            <span>Streaming</span>
            <span className="text-mimo-400">SSE (reasoning_content)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
