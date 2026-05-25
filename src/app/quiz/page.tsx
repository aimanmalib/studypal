"use client";

import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function QuizPage() {
  const { quizQuestions, currentQuestionIndex, score, quizComplete, setQuizQuestions, answerQuestion, nextQuestion, resetQuiz } = useStore();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: 5 }),
      });
      const data = await res.json();
      setQuizQuestions(data.questions || []);
    } catch {
      alert('Failed to generate quiz');
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
      <h1 className="text-2xl font-bold mb-6">📝 Quiz</h1>

      {/* Generator */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-mimo-500"
        />
        <button onClick={generate} disabled={loading} className="px-4 py-2 bg-mimo-600 hover:bg-mimo-500 rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? '...' : 'Generate Quiz'}
        </button>
      </div>

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
                const letter = opt.charAt(0);
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
                        : 'bg-slate-800 border-slate-700 hover:border-mimo-500 hover:bg-slate-750'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <div className="mt-4 p-4 bg-slate-900 rounded-xl text-sm text-slate-300">
                <strong className="text-mimo-400">Explanation:</strong> {question.explanation}
              </div>
            )}
          </div>

          {showExplanation && (
            <button onClick={handleNext} className="w-full py-3 bg-mimo-600 hover:bg-mimo-500 rounded-xl font-medium">
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
          <p className="text-4xl font-bold text-mimo-400 mb-2">
            {score} / {quizQuestions.length}
          </p>
          <p className="text-slate-400 mb-6">
            {score >= quizQuestions.length * 0.8
              ? 'Excellent! You really know this topic!'
              : score >= quizQuestions.length * 0.5
              ? 'Good effort! Review the tricky ones.'
              : 'Keep studying! You will get there.'}
          </p>
          <button onClick={resetQuiz} className="px-6 py-2 bg-mimo-600 hover:bg-mimo-500 rounded-lg">
            Try Again
          </button>
        </div>
      )}

      {quizQuestions.length === 0 && !loading && (
        <div className="text-center py-20 text-slate-500">
          <div className="text-5xl mb-4">📝</div>
          <p>Enter a topic above to start a quiz</p>
        </div>
      )}
    </div>
  );
}
