"use client";

import { create } from 'zustand';
import type { PublicServerInfo } from './llm-config';
import type { TokenUsage } from './llm';
import { LLMSettings, clearSettings, loadSettings, saveSettings } from './client/settings';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
  /** Set when the request failed; the bubble shows this instead of content. */
  error?: { message: string; needsSettings: boolean };
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  mastered: boolean;
}

export interface UsageStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  /** Requests whose usage the provider reported. */
  calls: number;
}

const EMPTY_USAGE: UsageStats = { totalTokens: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, calls: 0 };

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  userAnswer?: string;
}

interface AppState {
  // Chat
  messages: Message[];
  isStreaming: boolean;
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string, error?: { message: string; needsSettings: boolean }) => void;
  setStreaming: (v: boolean) => void;
  clearMessages: () => void;

  // Flashcards
  flashcards: Flashcard[];
  currentCardIndex: number;
  isFlipped: boolean;
  setFlashcards: (cards: Flashcard[]) => void;
  flipCard: () => void;
  nextCard: () => void;
  prevCard: () => void;
  toggleMastered: (id: string) => void;

  // Quiz
  quizQuestions: QuizQuestion[];
  currentQuestionIndex: number;
  score: number;
  quizComplete: boolean;
  setQuizQuestions: (q: QuizQuestion[]) => void;
  answerQuestion: (answer: string) => void;
  nextQuestion: () => void;
  resetQuiz: () => void;

  // Topic
  currentTopic: string;
  setTopic: (topic: string) => void;

  // Provider settings (bring-your-own-key) and server mode
  settings: LLMSettings | null;
  settingsLoaded: boolean;
  /** False when the browser refused localStorage; settings then last for this tab only. */
  settingsPersisted: boolean;
  settingsOpen: boolean;
  serverInfo: PublicServerInfo | null;
  loadStoredSettings: () => void;
  setServerInfo: (info: PublicServerInfo | null) => void;
  updateSettings: (settings: LLMSettings) => void;
  forgetKey: () => void;
  setSettingsOpen: (open: boolean) => void;

  // Token usage for this browser session
  usage: UsageStats;
  trackUsage: (usage: TokenUsage) => void;
  resetUsage: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Chat
  messages: [],
  isStreaming: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (content, error) =>
    set((s) => ({
      messages: s.messages.map((m, i) =>
        i === s.messages.length - 1 ? { ...m, content, error } : m
      ),
    })),
  setStreaming: (v) => set({ isStreaming: v }),
  clearMessages: () => set({ messages: [] }),

  // Flashcards
  flashcards: [],
  currentCardIndex: 0,
  isFlipped: false,
  setFlashcards: (cards) => set({ flashcards: cards, currentCardIndex: 0, isFlipped: false }),
  flipCard: () => set((s) => ({ isFlipped: !s.isFlipped })),
  nextCard: () =>
    set((s) => ({
      currentCardIndex: Math.min(s.currentCardIndex + 1, s.flashcards.length - 1),
      isFlipped: false,
    })),
  prevCard: () =>
    set((s) => ({
      currentCardIndex: Math.max(s.currentCardIndex - 1, 0),
      isFlipped: false,
    })),
  toggleMastered: (id) =>
    set((s) => ({
      flashcards: s.flashcards.map((c) =>
        c.id === id ? { ...c, mastered: !c.mastered } : c
      ),
    })),

  // Quiz
  quizQuestions: [],
  currentQuestionIndex: 0,
  score: 0,
  quizComplete: false,
  setQuizQuestions: (q) =>
    set({ quizQuestions: q, currentQuestionIndex: 0, score: 0, quizComplete: false }),
  answerQuestion: (answer) => {
    const s = get();
    const q = s.quizQuestions[s.currentQuestionIndex];
    const correct = answer === q.correct;
    set((prev) => ({
      quizQuestions: prev.quizQuestions.map((q, i) =>
        i === prev.currentQuestionIndex ? { ...q, userAnswer: answer } : q
      ),
      score: correct ? prev.score + 1 : prev.score,
    }));
  },
  nextQuestion: () => {
    const s = get();
    if (s.currentQuestionIndex >= s.quizQuestions.length - 1) {
      set({ quizComplete: true });
    } else {
      set({ currentQuestionIndex: s.currentQuestionIndex + 1 });
    }
  },
  resetQuiz: () =>
    set({ currentQuestionIndex: 0, score: 0, quizComplete: false }),

  // Topic
  currentTopic: '',
  setTopic: (topic) => set({ currentTopic: topic }),

  // Provider settings
  settings: null,
  settingsLoaded: false,
  settingsPersisted: true,
  settingsOpen: false,
  serverInfo: null,
  loadStoredSettings: () => set({ settings: loadSettings(), settingsLoaded: true }),
  setServerInfo: (info) => set({ serverInfo: info }),
  updateSettings: (settings) => set({ settings, settingsPersisted: saveSettings(settings) }),
  forgetKey: () => {
    const current = get().settings;
    clearSettings();
    if (!current) return;
    const settings = { ...current, apiKey: '' };
    // Keep the provider/model choice, but never the key.
    set({ settings, settingsPersisted: saveSettings(settings) });
  },
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  // Token usage
  usage: EMPTY_USAGE,
  trackUsage: (u) =>
    set((s) => ({
      usage: {
        totalTokens: s.usage.totalTokens + u.total_tokens,
        promptTokens: s.usage.promptTokens + u.prompt_tokens,
        completionTokens: s.usage.completionTokens + u.completion_tokens,
        cachedTokens: s.usage.cachedTokens + (u.cached_tokens ?? 0),
        calls: s.usage.calls + 1,
      },
    })),
  resetUsage: () => set({ usage: EMPTY_USAGE }),
}));
