"use client";

import { useState } from 'react';
import { ArrowRight, BookOpen, CircleCheck, CircleX, ListChecks, RotateCcw, Sparkles, ThumbsUp, Trophy } from 'lucide-react';
import { useStore, QuizQuestion } from '@/lib/store';
import type { TokenUsage } from '@/lib/llm';
import { useStudyApi } from '@/hooks/useStudyApi';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { EmptyState, ErrorNotice, KeyNotice, LoadingPanel, PageHeader, UiError, useErrorHandler } from '@/components/Notices';
import { useI18n } from '@/i18n/I18nProvider';

const QUESTION_COUNT = 5;
const optionLetter = (opt: string) => opt.trim().charAt(0).toUpperCase();

export default function QuizPage() {
  const { quizQuestions, currentQuestionIndex, score, quizComplete, setQuizQuestions, answerQuestion, nextQuestion, resetQuiz } = useStore();
  const { t } = useI18n();
  const api = useStudyApi();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const { track } = useTokenTracker();
  const handleError = useErrorHandler();

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.postJson<{ questions: QuizQuestion[]; usage?: TokenUsage }>('/api/quiz', {
        topic,
        count: QUESTION_COUNT,
      });
      setSelectedAnswer(null);
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
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    nextQuestion();
  };

  const retry = () => {
    setSelectedAnswer(null);
    resetQuiz();
  };

  const question = quizQuestions[currentQuestionIndex];
  const answered = selectedAnswer !== null;
  const total = quizQuestions.length;
  const ratio = total ? score / total : 0;
  const result =
    ratio >= 0.8
      ? { Icon: Trophy, text: t('quiz.resultExcellent') }
      : ratio >= 0.5
        ? { Icon: ThumbsUp, text: t('quiz.resultGood') }
        : { Icon: BookOpen, text: t('quiz.resultKeepGoing') };

  return (
    <div className="mx-auto max-w-2xl">
      <KeyNotice />
      <PageHeader title={t('quiz.title')} intro={t('quiz.intro')} />

      <form onSubmit={generate} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('quiz.topicPlaceholder')}
          aria-label={t('common.topic')}
          maxLength={200}
          className="field min-w-0 flex-1 px-4 text-base sm:text-sm"
        />
        <button type="submit" disabled={loading || !topic.trim()} className="btn-primary shrink-0 px-5 text-sm">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {loading ? t('quiz.generating') : t('quiz.generate')}
        </button>
      </form>

      {error && <ErrorNotice error={error} className="mb-6" />}

      {loading && <LoadingPanel label={t('quiz.loadingBody', { n: QUESTION_COUNT, topic: topic.trim() })} lines={5} />}

      {question && !quizComplete && !loading && (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>{t('quiz.position', { i: currentQuestionIndex + 1, n: total })}</span>
            <span>{t('quiz.score', { n: score })}</span>
          </div>
          <div
            className="mb-4 h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={t('quiz.position', { i: currentQuestionIndex + 1, n: total })}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={currentQuestionIndex + (answered ? 1 : 0)}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${((currentQuestionIndex + (answered ? 1 : 0)) / total) * 100}%` }}
            />
          </div>

          <div className="card mb-5 p-5 sm:p-6">
            <h2 className="mb-5 text-lg leading-snug font-semibold">{question.question}</h2>
            <div className="space-y-2.5">
              {question.options.map((opt, i) => {
                const letter = optionLetter(opt);
                const isSelected = selectedAnswer === letter;
                const isCorrect = letter === question.correct;
                const state = !answered ? 'idle' : isCorrect ? 'correct' : isSelected ? 'wrong' : 'other';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAnswer(letter)}
                    aria-disabled={answered}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition sm:text-base ${
                      state === 'correct'
                        ? 'border-success-line bg-success-soft text-success-fg'
                        : state === 'wrong'
                          ? 'border-danger-line bg-danger-soft text-danger-fg'
                          : state === 'other'
                            ? 'cursor-default border-line text-muted'
                            : 'border-line-field bg-surface hover:border-accent-fg hover:bg-surface-2'
                    }`}
                  >
                    <span className="flex-1">{opt}</span>
                    {state === 'correct' && (
                      <>
                        <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="sr-only">({t('quiz.correctAnswer')})</span>
                      </>
                    )}
                    {state === 'wrong' && (
                      <>
                        <CircleX className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="sr-only">({t('quiz.yourAnswer')})</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div role="status" className="mt-5 rounded-xl bg-inset p-4 text-sm leading-relaxed">
                <p className={`mb-1 font-semibold ${selectedAnswer === question.correct ? 'text-success-fg' : 'text-danger-fg'}`}>
                  {selectedAnswer === question.correct ? t('quiz.correct') : t('quiz.incorrect')}
                </p>
                {question.explanation && (
                  <p className="text-muted">
                    <strong className="font-semibold text-fg">{t('quiz.explanation')}:</strong> {question.explanation}
                  </p>
                )}
              </div>
            )}
          </div>

          {answered && (
            <button type="button" onClick={handleNext} className="btn-primary w-full text-base">
              {currentQuestionIndex >= total - 1 ? t('quiz.seeResults') : t('quiz.next')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {quizComplete && !loading && (
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-fg">
            <result.Icon className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="mb-2 text-2xl font-bold tracking-tight">{t('quiz.complete')}</h2>
          <p className="mb-2 text-4xl font-bold text-accent-fg">{t('quiz.resultScore', { score, n: total })}</p>
          <p className="mb-6 text-muted">{result.text}</p>
          <button type="button" onClick={retry} className="btn-primary px-6 text-sm">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('quiz.retry')}
          </button>
        </div>
      )}

      {total === 0 && !loading && !error && (
        <EmptyState icon={ListChecks} title={t('quiz.emptyTitle')} body={t('quiz.empty')} />
      )}
    </div>
  );
}
