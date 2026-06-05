import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StudyPal — AI Study Assistant',
  description: 'AI-powered study assistant with flashcards, quizzes, and personalized learning. Runs on any OpenAI-compatible LLM.',
  keywords: ['AI', 'study', 'flashcards', 'quiz', 'LLM', 'OpenAI', 'learning'],
  openGraph: {
    title: 'StudyPal',
    description: 'Your AI study companion, powered by any OpenAI-compatible LLM',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mimo-500 to-mimo-400 flex items-center justify-center font-bold text-sm">
                SP
              </div>
              <span className="font-semibold text-lg">StudyPal</span>
              <span className="text-xs text-mimo-400 bg-mimo-500/10 px-2 py-0.5 rounded-full">
                Multi-LLM
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <a href="/" className="text-slate-400 hover:text-white transition">Chat</a>
              <a href="/flashcards" className="text-slate-400 hover:text-white transition">Flashcards</a>
              <a href="/quiz" className="text-slate-400 hover:text-white transition">Quiz</a>
              <a href="/dashboard" className="text-slate-400 hover:text-white transition">Stats</a>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
