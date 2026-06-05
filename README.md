# StudyPal

> **AI Study Assistant for any OpenAI-compatible LLM**
>
> Chat, flashcards, quizzes, and study plans — streaming SSE responses, runs on OpenAI, OpenRouter, Ollama, or Xiaomi MiMo.

[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/aimanmalib/studypal/actions/workflows/ci.yml/badge.svg)](https://github.com/aimanmalib/studypal/actions/workflows/ci.yml)
[![Tests: 19](https://img.shields.io/badge/tests-19-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Works with **OpenAI, OpenRouter, Ollama, llama.cpp, Xiaomi MiMo**, or any endpoint that speaks the OpenAI `/chat/completions` protocol. Pick a provider with one env var — no code changes.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     StudyPal                                │
│               Any OpenAI-compatible LLM backend             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  💬 Chat    │  │ 📇 Flashcards│  │ 📝 Quiz     │         │
│  │  (SSE)      │  │ (JSON)      │  │ (JSON)      │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         ▼                ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Next.js API Routes (Edge)               │    │
│  │         /api/chat  /api/flashcards  /api/quiz       │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           OpenAI-compatible LLM Client               │    │
│  │  Streaming SSE · reasoning_content · bearer/api-key │    │
│  │  Providers: OpenAI · OpenRouter · Ollama · MiMo     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Token Tracker (client-side)                │    │
│  │  Per-session stats · Cache hit rate · Avg/call      │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Features

| Feature | Description | Streaming |
|---------|-------------|-----------|
| 💬 **Chat** | Ask questions, get explanations with reasoning | SSE streaming |
| 📇 **Flashcards** | Auto-generated study cards with spaced repetition | JSON response |
| 📝 **Quiz** | Adaptive quizzes with explanations | JSON response |
| 📋 **Summarize** | Paste content, get study-optimized summaries | SSE streaming |
| 📊 **Dashboard** | Real-time token consumption tracking | Client-side |

## Supported Providers

StudyPal talks to any OpenAI-compatible `/chat/completions` endpoint. Built-in presets:

| Provider | `LLM_PROVIDER` | Default model | Auth | Key env var |
|----------|----------------|---------------|------|-------------|
| OpenAI | `openai` | `gpt-4o-mini` | Bearer | `OPENAI_API_KEY` |
| OpenRouter | `openrouter` | `openai/gpt-4o-mini` | Bearer | `OPENROUTER_API_KEY` |
| Ollama (local) | `ollama` | `llama3.1` | Bearer | `OLLAMA_BASE_URL` |
| Xiaomi MiMo | `mimo` | `mimo-v2.5-pro` | api-key | `MIMO_API_KEY` |

Set `LLM_PROVIDER` + the matching key (or just `LLM_API_KEY`). Override `LLM_BASE_URL` / `LLM_MODEL` for any other compatible endpoint (llama.cpp, vLLM, LM Studio). The right auth header (bearer vs api-key) is chosen automatically. The chat feature surfaces a model's `reasoning_content` when available, but it isn't required.

## Token Consumption

Per-feature estimated consumption:

- **Chat message**: ~800 tokens (400 prompt + 400 completion)
- **Flashcard set (8 cards)**: ~600 tokens
- **Quiz (5 questions)**: ~500 tokens
- **Summarize (1000 words)**: ~1200 tokens

Daily estimate for active student: **20K-50K tokens/day**

## Quick Start

```bash
# Clone and install
git clone https://github.com/aimanmalib/studypal.git
cd studypal
npm install

# Set environment — pick any provider (OpenAI shown here)
echo 'LLM_PROVIDER=openai' > .env.local
echo 'OPENAI_API_KEY=YOUR_KEY_HERE' >> .env.local

# Run dev server
npm run dev
# Open http://localhost:3000

# Run tests
npm test

# Build for production
npm run build
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add LLM_PROVIDER
vercel env add OPENAI_API_KEY
```

## API Routes

### `POST /api/chat`
SSE streaming chat with the configured LLM.

```json
{ "messages": [{"role": "user", "content": "..."}], "topic": "optional" }
```

### `POST /api/flashcards`
Generate flashcards for a topic.

```json
{ "topic": "Machine Learning", "count": 8, "difficulty": "mixed" }
```

### `POST /api/quiz`
Generate a quiz.

```json
{ "topic": "Calculus", "count": 5, "difficulty": "mixed" }
```

### `POST /api/summarize`
SSE streaming content summarization.

```json
{ "content": "paste text here...", "topic": "optional" }
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript 5.4, Tailwind CSS 3.4
- **State**: Zustand (client-side)
- **Animations**: Framer Motion
- **AI**: any OpenAI-compatible LLM (OpenAI, OpenRouter, Ollama, Xiaomi MiMo)
- **Auth**: bearer token or `api-key` header, selected automatically per provider
- **Streaming**: Server-Sent Events (SSE) with optional `reasoning_content`
- **Deploy**: Vercel Edge Functions

## Project Structure

```
studypal/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts          # SSE streaming chat
│   │   │   ├── flashcards/route.ts    # Flashcard generation
│   │   │   ├── quiz/route.ts          # Quiz generation
│   │   │   └── summarize/route.ts     # SSE streaming summary
│   │   ├── dashboard/page.tsx         # Token stats
│   │   ├── flashcards/page.tsx        # Flashcard viewer
│   │   ├── quiz/page.tsx              # Quiz interface
│   │   ├── page.tsx                   # Main chat page
│   │   ├── layout.tsx                 # Root layout
│   │   └── globals.css                # Tailwind + custom styles
│   ├── components/                    # Reusable components
│   ├── hooks/
│   │   └── useTokenTracker.ts         # Token consumption hook
│   └── lib/
│       ├── mimo.ts                    # OpenAI-compatible LLM client (SSE)
│       ├── prompts.ts                 # System prompts per feature
│       └── store.ts                   # Zustand state management
├── tests/                             # Jest + React Testing Library
├── docs/                              # Documentation
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Provider-agnostic** — runs on OpenAI, OpenRouter, Ollama, llama.cpp, Xiaomi MiMo, or any OpenAI-compatible `/chat/completions` endpoint.
