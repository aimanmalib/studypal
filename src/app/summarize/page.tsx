"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '@/lib/store';
import { MAX_SUMMARY_INPUT } from '@/lib/api';
import { postStream } from '@/lib/client/request';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { ErrorNotice, KeyNotice, UiError, useErrorHandler } from '@/components/Notices';

export default function SummarizePage() {
  const settings = useStore((s) => s.settings);
  const { track } = useTokenTracker();
  const handleError = useErrorHandler();
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  const summarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSummary('');
    let text = '';
    try {
      await postStream('/api/summarize', { content, topic }, settings, (event) => {
        if (event.content) {
          text += event.content;
          setSummary(text);
        }
        if (event.usage) track(event.usage);
      });
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <KeyNotice />
      <h1 className="mb-2 text-2xl font-bold">Summarize</h1>
      <p className="mb-6 text-sm text-slate-400">
        Paste notes, an article or a textbook section and get a structured study summary.
      </p>

      <form onSubmit={summarize} className="space-y-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (optional)"
          aria-label="Topic"
          maxLength={200}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-base focus:border-brand-500 focus:outline-none sm:text-sm"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the text to summarize…"
          aria-label="Text to summarize"
          maxLength={MAX_SUMMARY_INPUT}
          rows={8}
          className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base focus:border-brand-500 focus:outline-none sm:text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {content.length.toLocaleString()} / {MAX_SUMMARY_INPUT.toLocaleString()} characters
          </span>
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium transition hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? 'Summarizing…' : 'Summarize'}
          </button>
        </div>
      </form>

      {error && <ErrorNotice error={error} className="mt-6" />}

      {(summary || (loading && !error)) && (
        <section aria-live="polite" className="mt-6 rounded-2xl border border-slate-700 bg-slate-800 p-5">
          {summary ? (
            <div className="prose-study text-sm">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          ) : (
            <span className="streaming-cursor text-sm text-slate-400">Reading</span>
          )}
        </section>
      )}
    </div>
  );
}
