# MiMo StudyPal

> **AI Study Assistant powered by Xiaomi MiMo V2.5 Pro**
>
> Chat, flashcards, quizzes, and study plans — all powered by MiMo's long-chain reasoning and streaming SSE.

[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Tests: 38](https://img.shields.io/badge/tests-38-brightgreen.svg)](tests/)
[![MiMo V2.5 Pro](https://img.shields.io/badge/MiMo-V2.5%20Pro-orange.svg)](https://platform.xiaomimimo.com)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     MiMo StudyPal                            │
│               Powered by Xiaomi MiMo V2.5 Pro                │
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
│  │              MiMo V2.5 Pro API Client                │    │
│  │  Streaming SSE · reasoning_content · api-key auth   │    │
│  │  Endpoint: token-plan-sgp.xiaomimimo.com/v1         │    │
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

## Why MiMo V2.5 Pro?

1. **Reasoning content** — Chat responses include `reasoning_content` showing the model's step-by-step thinking process, which helps students understand *how* to solve problems
2. **SSE streaming quality** — Real-time token-by-token output for natural conversation flow without buffering
3. **Structured output** — MiMo reliably produces valid JSON for flashcard and quiz generation without schema enforcement
4. **Chinese/Malay support** — StudyPal works in 亚洲 languages without quality degradation
5. **Cost efficiency** — Token Plan pricing makes it viable for student use (~$0.20/M cache hit)

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
git clone https://github.com/YOUR_USERNAME/mimo-studypal.git
cd mimo-studypal
npm install

# Set environment
echo "MIMO_API_KEY=your-token-plan-key" > .env.local

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

# Set environment variable
vercel env add MIMO_API_KEY
```

## API Routes

### `POST /api/chat`
SSE streaming chat with MiMo.

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
- **AI**: Xiaomi MiMo V2.5 Pro via Token Plan API
- **Auth**: `api-key` header (NOT `Authorization: Bearer`)
- **Streaming**: Server-Sent Events (SSE) with `reasoning_content`
- **Deploy**: Vercel Edge Functions

## Project Structure

```
mimo-studypal/
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
│       ├── mimo.ts                    # MiMo API client (SSE)
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

**Built with Xiaomi MiMo V2.5 Pro** via Token Plan API
`token-plan-sgp.xiaomimimo.com/v1`
