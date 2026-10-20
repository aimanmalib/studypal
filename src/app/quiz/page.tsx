"use client";

import { useState } from 'react';
import { useStore, QuizQuestion } from '@/lib/store';
import { postJson } from '@/lib/client/request';
import type { TokenUsage } from '@/lib/llm';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { ErrorNotice, KeyNotice, UiError, useErrorHandler } from '@/components/Notices';

const optionLetter = (opt: string) => opt.trim().charAt(0).toUpperCase();

export default function QuizPage() {
  const { quizQuestions, currentQuestionIndex, score, quizComplete, setQuizQuestions, answerQuestion, nextQuestion, resetQuiz } = useStore();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const settings = useStore((s) => s.settings);
  const { track } = useTokenTracker();
  const handleError = useErrorHandler();

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ questions: QuizQuestion[]; usage?: TokenUsage }>(
        '/api/quiz',
        { topic, count: 5 },
        settings,
      );
      setSelectedAnswer(null);
      setShowExplanation(false);
      setQuizQuestions(data.questions);
      if (data.usage?.total_tokens) track(data.usage);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    answerQuestion(answer);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    nextQuestion();
  };

  const question = quizQuestions[currentQuestionIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <KeyNotice />
      <h1 className="text-2xl font-bold mb-6">Quiz</h1>

      <form onSubmit={generate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic…"
          aria-label="Topic"
          maxLength={200}
          className="min-w-0 flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-base sm:text-sm focus:outline-hidden focus:border-brand-500"
        />
        <button type="submit" disabled={loading || !topic.trim()} className="shrink-0 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Generating…' : 'Generate quiz'}
        </button>
      </form>

      {error && <ErrorNotice error={error} className="mb-6" />}

      {/* Quiz in progress */}
      {question && !quizComplete && (
        <div>
          <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
            <span>Question {currentQuestionIndex + 1} / {quizQuestions.length}</span>
            <span>Score: {score}</span>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">{question.question}</h3>
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                const letter = optionLetter(opt);
                const isSelected = selectedAnswer === letter;
                const isCorrect = letter === question.correct;
                const showResult = showExplanation;

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(letter)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      showResult
                        ? isCorrect
                          ? 'bg-green-900/30 border-green-500 text-green-300'
                          : isSelected
                          ? 'bg-red-900/30 border-red-500 text-red-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                        : 'bg-slate-800 border-slate-700 hover:border-brand-500 hover:bg-slate-700/60'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <div className="mt-4 p-4 bg-slate-900 rounded-xl text-sm text-slate-300">
                <strong className="text-brand-400">Explanation:</strong> {question.explanation}
              </div>
            )}
          </div>

          {showExplanation && (
            <button onClick={handleNext} className="w-full py-3 bg-brand-600 hover:bg-brand-500 rounded-xl font-medium">
              {currentQuestionIndex >= quizQuestions.length - 1 ? 'See Results' : 'Next Question →'}
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {quizComplete && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">
            {score >= quizQuestions.length * 0.8 ? '🏆' : score >= quizQuestions.length * 0.5 ? '👍' : '📚'}
          </div>
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-4xl font-bold text-brand-400 mb-2">
            {score} / {quizQuestions.length}
          </p>
          <p className="text-slate-400 mb-6">
            {score >= quizQuestions.length * 0.8
              ? 'Excellent! You really know this topic!'
              : score >= quizQuestions.length * 0.5
              ? 'Good effort! Review the tricky ones.'
              : 'Keep studying! You will get there.'}
          </p>
          <button onClick={resetQuiz} className="px-6 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg">
            Try Again
          </button>
        </div>
      )}

      {quizQuestions.length === 0 && !loading && !error && (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4" aria-hidden="true">📝</div>
          <p>Enter a topic above to start a quiz.</p>
        </div>
      )}
    </div>
  );
}
