import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatPage from '../src/app/page';
import FlashcardsPage from '../src/app/flashcards/page';
import SettingsDialog from '../src/components/SettingsDialog';
import { I18nProvider, useI18n } from '../src/i18n/I18nProvider';
import { LANGUAGE_STORAGE_KEY } from '../src/lib/language';
import { useStore } from '../src/lib/store';

// react-markdown is ESM-only; these tests do not render Markdown.
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: string }) => children }));

const realFetch = global.fetch;

beforeAll(() => {
  // jsdom has no layout, so no scrollIntoView.
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  window.localStorage.clear();
  useStore.setState({
    messages: [],
    isStreaming: false,
    flashcards: [],
    settings: null,
    settingsLoaded: true,
    settingsOpen: false,
    serverInfo: { mode: 'server', allowCustomBaseUrl: false, maxTokens: 2048 },
  });
});

afterEach(() => {
  global.fetch = realFetch;
});

/** fetch that records the request and then fails like a dropped connection. */
function failingFetch() {
  const fn = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const bodyOf = (fetchMock: jest.Mock) => JSON.parse(fetchMock.mock.calls[0][1].body);

function LanguageButtons() {
  const { setLanguage } = useI18n();
  return (
    <>
      <button onClick={() => setLanguage('en')}>to-en</button>
      <button onClick={() => setLanguage('ms')}>to-ms</button>
    </>
  );
}

describe('interface language reaches the API', () => {
  it('chat in Bahasa Melayu sends language "ms" and shows errors in Malay', async () => {
    const fetchMock = failingFetch();
    render(
      <I18nProvider initialLanguage="ms" fromCookie>
        <ChatPage />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Selamat datang ke StudyPal' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Soalan anda'), { target: { value: 'Apa itu fotosintesis?' } });
    fireEvent.click(screen.getByRole('button', { name: /Hantar/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/chat');
    expect(bodyOf(fetchMock)).toMatchObject({ language: 'ms', messages: [{ role: 'user', content: 'Apa itu fotosintesis?' }] });
    expect((await screen.findByRole('alert')).textContent).toContain('Tidak dapat menghubungi StudyPal');
  });

  it('switching language changes the text and the next request', async () => {
    const fetchMock = failingFetch();
    render(
      <I18nProvider initialLanguage="en" fromCookie={false}>
        <LanguageButtons />
        <FlashcardsPage />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Flashcards' })).toBeTruthy();

    act(() => screen.getByText('to-ms').click());
    expect(screen.getByRole('heading', { name: 'Kad Imbas' })).toBeTruthy();
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ms');
    expect(document.documentElement.lang).toBe('ms');

    fireEvent.change(screen.getByLabelText('Topik'), { target: { value: 'Biologi sel' } });
    fireEvent.click(screen.getByRole('button', { name: /Jana/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf(fetchMock)).toEqual({ topic: 'Biologi sel', count: 8, language: 'ms' });

    act(() => screen.getByText('to-en').click());
    expect(screen.getByRole('heading', { name: 'Flashcards' })).toBeTruthy();
  });

  it('a saved choice in localStorage wins over the server default', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ms');
    render(
      <I18nProvider initialLanguage="en" fromCookie={false}>
        <FlashcardsPage />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Kad Imbas' })).toBeTruthy();
  });

  it('renders Settings in Bahasa Melayu', () => {
    useStore.setState({ serverInfo: { mode: 'byok', allowCustomBaseUrl: false, maxTokens: 2048 } });
    render(
      <I18nProvider initialLanguage="ms" fromCookie>
        <SettingsDialog />
      </I18nProvider>,
    );
    act(() => useStore.getState().setSettingsOpen(true));
    expect(screen.getByRole('dialog', { name: 'Tetapan' })).toBeTruthy();
    expect(screen.getByLabelText('Kunci API')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByRole('alert').textContent).toBe('Tampal kunci API OpenAI anda untuk meneruskan.');
  });
});
