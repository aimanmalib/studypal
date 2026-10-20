import type { Metadata, Viewport } from 'next';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'StudyPal — AI Study Assistant',
  description:
    'Open-source AI study assistant: chat, flashcards, quizzes and summaries on any OpenAI-compatible LLM. Bring your own API key.',
  keywords: ['AI', 'study', 'flashcards', 'quiz', 'LLM', 'OpenAI', 'learning'],
  openGraph: {
    title: 'StudyPal',
    description: 'Open-source AI study assistant for any OpenAI-compatible LLM. Bring your own API key.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-slate-950 text-slate-50 antialiased">
        <AppShell />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
