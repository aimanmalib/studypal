import { act, fireEvent, render, screen } from '@testing-library/react';
import SettingsDialog from '../src/components/SettingsDialog';
import {
  SETTINGS_STORAGE_KEY,
  clearSettings,
  defaultSettings,
  loadSettings,
  maskKey,
  saveSettings,
  settingsHeaders,
} from '../src/lib/client/settings';
import { useStore } from '../src/lib/store';

const KEY = ['sk', 'test', 'abcdef123456'].join('-');

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

beforeEach(() => {
  window.localStorage.clear();
  useStore.setState({
    settings: null,
    settingsLoaded: true,
    settingsPersisted: true,
    settingsOpen: false,
    serverInfo: { mode: 'byok', allowCustomBaseUrl: false, maxTokens: 2048 },
  });
});

describe('settings storage', () => {
  it('round-trips through localStorage', () => {
    const s = { ...defaultSettings('deepseek'), apiKey: KEY };
    expect(saveSettings(s)).toBe(true);
    expect(loadSettings()).toEqual(s);
    clearSettings();
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('survives blocked storage instead of crashing', () => {
    expect(loadSettings(throwingStorage)).toBeNull();
    expect(saveSettings(defaultSettings(), throwingStorage)).toBe(false);
    expect(() => clearSettings(throwingStorage)).not.toThrow();
  });

  it('ignores corrupt or unknown stored data', () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    expect(loadSettings()).toBeNull();
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ provider: 'evil', apiKey: KEY }));
    expect(loadSettings()).toBeNull();
  });

  it('builds request headers and omits an empty key', () => {
    expect(settingsHeaders(null)).toEqual({});
    expect(settingsHeaders({ ...defaultSettings('groq'), model: '' })).toEqual({
      'x-llm-provider': 'groq',
      'x-llm-model': 'llama-3.3-70b-versatile',
    });
    expect(settingsHeaders({ ...defaultSettings(), apiKey: ` ${KEY} ` })['x-llm-key']).toBe(KEY);
  });

  it('masks keys for display', () => {
    expect(maskKey(KEY)).toBe('sk-…3456');
    expect(maskKey('short')).toBe('•••••');
    expect(maskKey('')).toBe('');
  });
});

describe('store: forgetKey', () => {
  it('removes the key from memory and storage but keeps the provider choice', () => {
    act(() => useStore.getState().updateSettings({ ...defaultSettings('mistral'), apiKey: KEY }));
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain(KEY);
    act(() => useStore.getState().forgetKey());
    expect(useStore.getState().settings).toMatchObject({ provider: 'mistral', apiKey: '' });
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toContain(KEY);
  });
});

describe('<SettingsDialog />', () => {
  const open = () => act(() => useStore.getState().setSettingsOpen(true));

  it('saves provider, model and key to this browser', () => {
    render(<SettingsDialog />);
    open();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByText(/never stores or logs it/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'groq' } });
    expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe('llama-3.3-70b-versatile');
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useStore.getState().settingsOpen).toBe(false);
    expect(loadSettings()).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: KEY, baseUrl: '' });
  });

  it('asks for a key instead of saving an empty one', () => {
    render(<SettingsDialog />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Paste your OpenAI API key/);
    expect(loadSettings()).toBeNull();
  });

  it('forgets the key', () => {
    useStore.getState().updateSettings({ ...defaultSettings(), apiKey: KEY });
    render(<SettingsDialog />);
    open();
    expect(screen.getByText('Saved key: sk-…3456')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Forget key/ }));
    expect(screen.getByRole('status').textContent).toBe('Key removed from this browser.');
    expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('');
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toContain(KEY);
  });

  it('marks local providers as self-host only on a hosted instance', () => {
    render(<SettingsDialog />);
    open();
    const ollama = screen.getByRole('option', { name: /Ollama/ }) as HTMLOptionElement;
    expect(ollama.disabled).toBe(true);
    expect(ollama.textContent).toContain('self-host only');
  });

  it('shows the server configuration instead of a key form in self-host mode', () => {
    useStore.setState({
      serverInfo: {
        mode: 'server',
        provider: 'groq',
        providerLabel: 'Groq',
        model: 'llama-3.3-70b-versatile',
        endpointHost: 'api.groq.com',
        authStyle: 'bearer',
        allowCustomBaseUrl: false,
        maxTokens: 2048,
      },
    });
    render(<SettingsDialog />);
    open();
    expect(screen.getByText(/set up by its owner/)).toBeTruthy();
    expect(screen.getByText('llama-3.3-70b-versatile')).toBeTruthy();
    expect(screen.queryByLabelText('API key')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<SettingsDialog />);
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
