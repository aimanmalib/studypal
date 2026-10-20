"use client";

import { useState } from 'react';
import { useStore, Flashcard } from '@/lib/store';
import { postJson } from '@/lib/client/request';
import type { TokenUsage } from '@/lib/llm';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { ErrorNotice, KeyNotice, UiError, useErrorHandler } from '@/components/Notices';

export default function FlashcardsPage() {
  const { flashcards, currentCardIndex, isFlipped, setFlashcards, flipCard, nextCard, prevCard, toggleMastered } = useStore();
  const settings = useStore((s) => s.settings);
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
      const data = await postJson<{ flashcards: Flashcard[]; usage?: TokenUsage }>(
        '/api/flashcards',
        { topic, count },
        settings,
      );
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
      <h1 className="mb-6 text-2xl font-bold">Flashcards</h1>

      <form onSubmit={generate} className="mb-6 flex flex-wrap gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic…"
          aria-label="Topic"
          maxLength={200}
          className="min-w-0 flex-[1_1_12rem] rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-base focus:border-brand-500 focus:outline-none sm:text-sm"
        />
        <select
          value={count}
          onChange={(e) => setCount(+e.target.value)}
          aria-label="Number of cards"
          className="select-field rounded-lg border border-slate-700 bg-slate-800 py-2 pr-9 pl-3 text-base sm:text-sm"
        >
          {[5, 8, 10, 15].map((n) => (
            <option key={n} value={n}>
              {n} cards
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium transition hover:bg-brand-500 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {error && <ErrorNotice error={error} className="mb-6" />}

      {card && (
        <>
          <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
            <span>
              Card {currentCardIndex + 1} / {flashcards.length}
            </span>
            <span>
              Mastered: {mastered} / {flashcards.length}
            </span>
          </div>

          <button
            type="button"
            onClick={flipCard}
            aria-label={isFlipped ? 'Show question' : 'Show answer'}
            className={`flex min-h-64 w-full items-center justify-center rounded-2xl p-6 text-center transition-colors duration-300 sm:p-8 ${
              isFlipped ? 'bg-slate-700' : 'gradient-border bg-slate-800'
            }`}
          >
            <div>
              <div className="mb-2 text-xs text-brand-400">{isFlipped ? 'Answer' : 'Question'}</div>
              <div className="text-lg break-words">{isFlipped ? card.back : card.front}</div>
              {card.difficulty && <div className="mt-4 text-xs text-slate-400">Difficulty: {card.difficulty}</div>}
            </div>
          </button>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <button onClick={prevCard} className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
              ← Prev
            </button>
            <button onClick={flipCard} className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium hover:bg-brand-500">
              Flip
            </button>
            <button
              onClick={() => toggleMastered(card.id)}
              className={`rounded-lg px-4 py-2 text-sm ${card.mastered ? 'bg-green-600' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              {card.mastered ? '✓ Mastered' : 'Mark mastered'}
            </button>
            <button onClick={nextCard} className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
              Next →
            </button>
          </div>
        </>
      )}

      {flashcards.length === 0 && !loading && !error && (
        <div className="py-20 text-center text-slate-400">
          <div className="mb-4 text-5xl" aria-hidden="true">
            📇
          </div>
          <p>Enter a topic above to generate flashcards.</p>
        </div>
      )}
    </div>
  );
}
