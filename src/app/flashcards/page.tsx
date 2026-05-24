"use client";

import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function FlashcardsPage() {
  const { flashcards, currentCardIndex, isFlipped, setFlashcards, flipCard, nextCard, prevCard, toggleMastered } = useStore();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(8);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count }),
      });
      const data = await res.json();
     setFlashcards(data.flashcards || []);
    } catch {
      alert('Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  };

  const card = flashcards[currentCardIndex];
  const mastered = flashcards.filter(c => c.mastered).length;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📇 Flashcards</h1>

      {/* Generator */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-mimo-500"
        />
        <select value={count} onChange={(e) => setCount(+e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          {[5, 8, 10, 15].map(n => <option key={n} value={n}>{n} cards</option>)}
        </select>
        <button onClick={generate} disabled={loading} className="px-4 py-2 bg-mimo-600 hover:bg-mimo-500 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? '...' : 'Generate'}
        </button>
      </div>

      {card && (
        <>
          {/* Progress */}
          <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
            <span>Card {currentCardIndex + 1} / {flashcards.length}</span>
            <span>Mastered: {mastered} / {flashcards.length}</span>
          </div>

          {/* Card */}
          <div
            onClick={flipCard}
            className="relative h-64 cursor-pointer perspective-1000"
          >
            <div className={`absolute inset-0 rounded-2xl p-8 flex items-center justify-center text-center transition-all duration-500 ${
              isFlipped ? 'bg-slate-700' : 'gradient-border bg-slate-800'
            }`}>
              <div>
                <div className="text-xs text-mimo-400 mb-2">
                  {isFlipped ? 'Answer' : 'Question'}
                </div>
                <div className="text-lg">
                  {isFlipped ? card.back : card.front}
                </div>
                {card.difficulty && (
                  <div className="mt-4 text-xs text-slate-500">
                    Difficulty: {card.difficulty}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button onClick={prevCard} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">
              ← Prev
            </button>
            <button onClick={flipCard} className="px-6 py-2 bg-mimo-600 hover:bg-mimo-500 rounded-lg text-sm font-medium">
              Flip
            </button>
            <button onClick={() => toggleMastered(card.id)} className={`px-4 py-2 rounded-lg text-sm ${card.mastered ? 'bg-green-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {card.mastered ? '✓ Mastered' : 'Mark Mastered'}
            </button>
            <button onClick={nextCard} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm">
              Next →
            </button>
          </div>
        </>
      )}

      {flashcards.length === 0 && !loading && (
        <div className="text-center py-20 text-slate-500">
          <div className="text-5xl mb-4">📇</div>
          <p>Enter a topic above to generate flashcards</p>
        </div>
      )}
    </div>
  );
}
