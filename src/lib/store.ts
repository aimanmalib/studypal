"use client";

import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  mastered: boolean;
}

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
  updateLastMessage: (content: string) => void;
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
}

export const useStore = create<AppState>((set, get) => ({
  // Chat
  messages: [],
  isStreaming: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (content) =>
    set((s) => ({
      messages: s.messages.map((m, i) =>
        i === s.messages.length - 1 ? { ...m, content } : m
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
}));
