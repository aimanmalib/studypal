import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import AppShell from '@/components/AppShell';
import { I18nProvider } from '@/i18n/I18nProvider';
import { translate } from '@/i18n';
import { LANGUAGE_COOKIE, Language, isLanguage, parseAcceptLanguage, pickLanguage } from '@/lib/language';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

/** The language to render on the server: the visitor's saved choice, else their browser language. */
async function requestLanguage(): Promise<{ language: Language; fromCookie: boolean }> {
  const saved = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (isLanguage(saved)) return { language: saved, fromCookie: true };
  const accept = (await headers()).get('accept-language');
  return { language: pickLanguage(parseAcceptLanguage(accept)), fromCookie: false };
}

export async function generateMetadata(): Promise<Metadata> {
  const { language } = await requestLanguage();
  const description = translate(language, 'meta.description');
  return {
    title: translate(language, 'meta.title'),
    description,
    keywords: ['AI', 'study', 'flashcards', 'quiz', 'LLM', 'OpenAI', 'learning', 'Bahasa Melayu', 'belajar'],
    openGraph: {
      title: 'StudyPal',
      description,
      type: 'website',
      locale: language === 'ms' ? 'ms_MY' : 'en_US',
      alternateLocale: language === 'ms' ? 'en_US' : 'ms_MY',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { language, fromCookie } = await requestLanguage();
  return (
    // data-theme is set by the inline script before paint, so React must not complain about it.
    <html lang={language} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <I18nProvider initialLanguage={language} fromCookie={fromCookie}>
          <AppShell />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
