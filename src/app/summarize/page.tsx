"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText } from 'lucide-react';
import { MAX_SUMMARY_INPUT } from '@/lib/api';
import { useStudyApi } from '@/hooks/useStudyApi';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { ErrorNotice, KeyNotice, PageHeader, UiError, useErrorHandler } from '@/components/Notices';
import { useI18n } from '@/i18n/I18nProvider';

export default function SummarizePage() {
  const { t, formatNumber } = useI18n();
  const api = useStudyApi();
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
      await api.postStream('/api/summarize', { content, topic }, (event) => {
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
      <PageHeader title={t('summarize.title')} intro={t('summarize.intro')} />

      <form onSubmit={summarize} className="space-y-4">
        <div>
          <label htmlFor="sum-topic" className="mb-1.5 block text-sm font-medium">
            {t('summarize.topicLabel')}
          </label>
          <input
            id="sum-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('summarize.topicPlaceholder')}
            maxLength={200}
            className="field w-full px-4 text-base sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="sum-content" className="mb-1.5 block text-sm font-medium">
            {t('summarize.contentLabel')}
          </label>
          <textarea
            id="sum-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('summarize.contentPlaceholder')}
            maxLength={MAX_SUMMARY_INPUT}
            rows={8}
            className="field w-full resize-y px-4 py-3 text-base leading-relaxed sm:text-sm"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted tabular-nums">
            {t('summarize.counter', { n: formatNumber(content.length), max: formatNumber(MAX_SUMMARY_INPUT) })}
          </span>
          <button type="submit" disabled={loading || !content.trim()} className="btn-primary px-5 text-sm">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {loading ? t('summarize.submitting') : t('summarize.submit')}
          </button>
        </div>
      </form>

      {error && <ErrorNotice error={error} className="mt-6" />}

      {(summary || (loading && !error)) && (
        <section aria-live="polite" aria-busy={loading} className="card mt-6 p-5 sm:p-6">
          <h2 className="mb-4 text-xs font-semibold tracking-wide text-accent-fg uppercase">{t('summarize.resultTitle')}</h2>
          {summary ? (
            <div className="prose-study text-sm">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          ) : (
            <span className="streaming-cursor text-sm text-muted">{t('summarize.reading')}</span>
          )}
        </section>
      )}
    </div>
  );
}
