"use client";

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Layers, Repeat2, Sparkles } from 'lucide-react';
import { useStore, Flashcard } from '@/lib/store';
import type { TokenUsage } from '@/lib/llm';
import { useStudyApi } from '@/hooks/useStudyApi';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { EmptyState, ErrorNotice, KeyNotice, LoadingPanel, PageHeader, UiError, useErrorHandler } from '@/components/Notices';
import { useI18n } from '@/i18n/I18nProvider';

const COUNTS = [5, 8, 10, 15];

export default function FlashcardsPage() {
  const { flashcards, currentCardIndex, isFlipped, setFlashcards, flipCard, nextCard, prevCard, toggleMastered } = useStore();
  const { t } = useI18n();
  const api = useStudyApi();
  const { track } = useTokenTracker();
  const handleError = useErrorHandler();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(8);
  const [error, setError] = useState<UiError | null>(null);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.postJson<{ flashcards: Flashcard[]; usage?: TokenUsage }>('/api/flashcards', { topic, count });
      setFlashcards(data.flashcards);
      if (data.usage?.total_tokens) track(data.usage);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const card = flashcards[currentCardIndex];
  const mastered = flashcards.filter((c) => c.mastered).length;

  return (
    <div className="mx-auto max-w-2xl">
      <KeyNotice />
      <PageHeader title={t('flashcards.title')} intro={t('flashcards.intro')} />

      <form onSubmit={generate} className="mb-6 flex flex-wrap gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('flashcards.topicPlaceholder')}
          aria-label={t('common.topic')}
          maxLength={200}
          className="field min-w-0 flex-[1_1_12rem] px-4 text-base sm:text-sm"
        />
        <select
          value={count}
          onChange={(e) => setCount(+e.target.value)}
          aria-label={t('flashcards.countLabel')}
          className="field select-field flex-1 py-2 pr-9 pl-3 text-base sm:flex-none sm:text-sm"
        >
          {COUNTS.map((n) => (
            <option key={n} value={n}>
              {t('flashcards.countOption', { n })}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading || !topic.trim()} className="btn-primary flex-1 px-5 text-sm sm:flex-none">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {loading ? t('flashcards.generating') : t('flashcards.generate')}
        </button>
      </form>

      {error && <ErrorNotice error={error} className="mb-6" />}

      {loading && <LoadingPanel label={t('flashcards.loadingBody', { n: count, topic: topic.trim() })} lines={4} />}

      {card && !loading && (
        <>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>{t('flashcards.position', { i: currentCardIndex + 1, n: flashcards.length })}</span>
            <span>{t('flashcards.masteredCount', { m: mastered, n: flashcards.length })}</span>
          </div>
          <div
            className="mb-4 h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={t('flashcards.mastered')}
            aria-valuemin={0}
            aria-valuemax={flashcards.length}
            aria-valuenow={mastered}
          >
            <div className="h-full rounded-full bg-success-line transition-[width] duration-300" style={{ width: `${(mastered / flashcards.length) * 100}%` }} />
          </div>

          <button
            type="button"
            onClick={flipCard}
            className={`flex min-h-64 w-full flex-col items-center justify-center rounded-2xl p-6 text-center shadow-[var(--shadow-card)] transition-colors duration-300 sm:p-10 ${
              isFlipped ? 'border border-accent-line bg-card-back' : 'gradient-border'
            }`}
          >
            <span className="mb-3 text-xs font-semibold tracking-wide text-accent-fg uppercase">
              {isFlipped ? t('flashcards.answer') : t('flashcards.question')}
            </span>
            <span aria-live="polite" className="text-lg leading-relaxed break-words sm:text-xl">
              {isFlipped ? card.back : card.front}
            </span>
            <span className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
              {card.difficulty && <span>{t('flashcards.difficulty', { level: t(`difficulty.${card.difficulty}`) })}</span>}
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span>{t('flashcards.tapToFlip')}</span>
            </span>
          </button>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-center sm:gap-3">
            <button
              type="button"
              onClick={prevCard}
              disabled={currentCardIndex === 0}
              className="btn-secondary order-3 px-4 text-sm sm:order-none"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('flashcards.prev')}
            </button>
            <button type="button" onClick={flipCard} className="btn-primary px-6 text-sm">
              <Repeat2 className="h-4 w-4" aria-hidden="true" />
              {t('flashcards.flip')}
            </button>
            <button
              type="button"
              onClick={() => toggleMastered(card.id)}
              aria-pressed={card.mastered}
              className={`btn-secondary px-4 text-sm ${card.mastered ? 'border-success-line bg-success-soft text-success-fg hover:bg-success-soft' : ''}`}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {card.mastered ? t('flashcards.mastered') : t('flashcards.markMastered')}
            </button>
            <button
              type="button"
              onClick={nextCard}
              disabled={currentCardIndex >= flashcards.length - 1}
              className="btn-secondary order-4 px-4 text-sm sm:order-none"
            >
              {t('flashcards.next')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {flashcards.length === 0 && !loading && !error && (
        <EmptyState icon={Layers} title={t('flashcards.emptyTitle')} body={t('flashcards.empty')} />
      )}
    </div>
  );
}
