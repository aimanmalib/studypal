# StudyPal

> **Open-source AI study assistant for any OpenAI-compatible LLM**
>
> Chat, flashcards, quizzes and study summaries, with streaming answers, in **English or Bahasa Melayu**. Bring your own API key, or self-host with a server key.

[![CI](https://github.com/aimanmalib/studypal/actions/workflows/ci.yml/badge.svg)](https://github.com/aimanmalib/studypal/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[Live demo →](https://studypal-pearl.vercel.app)** (bring your own key: open **Settings**, pick a provider and paste your API key)

StudyPal talks to any endpoint that speaks the OpenAI `/chat/completions` protocol. It ships presets for OpenAI, OpenRouter, Groq, DeepSeek, Together AI, Mistral, Xiaomi MiMo, Ollama and llama.cpp.

---

## Features

| Feature | What it does | Response |
|---------|--------------|----------|
| 💬 **Chat** | Ask questions; answers explain step by step and render Markdown | SSE stream |
| 📇 **Flashcards** | Generate 5–15 cards on a topic, flip through them, mark cards as mastered | JSON |
| 📝 **Quiz** | Five multiple-choice questions with explanations and a score | JSON |
| 📋 **Summarize** | Paste up to 30,000 characters and get a structured study summary | SSE stream |
| 📊 **Stats** | The provider and model in use, plus the token usage your provider reported in this tab | Client-side |

### English and Bahasa Melayu

- Every screen is available in English and Bahasa Melayu. Switch with the **EN / BM** control in the header. The first visit follows the browser language (`ms`, `ms-MY` … → Bahasa Melayu, anything else → English); a choice is remembered in `localStorage` (plus a cookie, so the server renders the right language without a flash of English).
- The AI answers in the selected language. Each request carries `"language": "en" | "ms"`, and the server adds a language rule to the system prompt (and repeats it in the user turn for flashcards, quizzes and summaries). For Bahasa Melayu the rule asks for standard Malaysian Malay and names common Indonesian words to avoid (*kirim*, *unduh*, *saat*, *karena*, *harus*…). This is an instruction to the model, so how well it is followed depends on the model you pick.
- All interface text lives in [`src/i18n/en.json`](src/i18n/en.json) and [`src/i18n/ms.json`](src/i18n/ms.json). A test fails if a key or `{placeholder}` is missing from either file, if a component uses an unknown key, or if interface text is hard-coded in JSX. Error messages from the API are shown in the selected language by error code.

### Light and dark themes

The dark theme is the default look; a light theme is available from the sun / moon button. Without a saved choice the operating system's `prefers-color-scheme` decides (also without JavaScript). Colours are semantic CSS tokens in [`src/app/globals.css`](src/app/globals.css), so both themes change together. Text colours meet WCAG AA (≥ 4.5:1) in both themes, for example body text 19.3:1 (dark) / 17.1:1 (light), secondary text 5.7:1 / 7.2:1, and white on the orange buttons 5.2:1; input borders and the focus ring are ≥ 3:1. Controls have a visible focus ring and touch targets of at least 44 px.

## Two ways to run it

### 1. Bring your own key (the live demo)

When the server has **no** LLM key in its environment, every visitor uses their own:

1. Open **Settings** (key button, top right; **Tetapan** in Bahasa Melayu).
2. Pick a provider. The model field fills in that provider's default; you can change it.
3. Paste your API key and press **Save**.

**What happens to your key**

- It is saved only in your browser (`localStorage`). **Forget key** removes it.
- With each request, the browser sends it to this app's own API route in an `x-llm-key` header (with `x-llm-provider` and `x-llm-model`). The route forwards it to the provider you chose for that one request.
- The server does not store it, does not log it, and never returns provider error bodies (some providers echo part of the key back).
- The server only calls the providers' official base URLs from [`src/lib/providers.ts`](src/lib/providers.ts). Local presets (Ollama, llama.cpp) and custom endpoints are refused unless the server owner sets `LLM_ALLOW_CUSTOM_BASE_URL=1`.
- Answers are capped at `LLM_MAX_TOKENS` tokens (2,048 by default).

Use a key with a spending limit, and remember that whoever runs a StudyPal server could change its code; only paste a key into a deployment you trust, or self-host.

### 2. Self-host with a server key

If the server environment provides a key, StudyPal uses it for every request and ignores anything the browser sends. The Settings panel then shows the configured provider and model instead of a key form.

```bash
git clone https://github.com/aimanmalib/studypal.git
cd studypal
npm install

cp .env.example .env.local   # then edit: pick a provider and add its key
npm run dev                  # http://localhost:3000
```

Leave the key variables empty to run your own copy in bring-your-own-key mode.

## Environment variables

All are optional. Without a key, the app runs in bring-your-own-key mode.

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | Preset id from the table below. Default `openai`. An unknown id is reported as a configuration error. |
| `LLM_API_KEY` | API key for the chosen provider. Setting any key switches the server to self-host mode. |
| `<PROVIDER>_API_KEY` | Provider-specific alternative to `LLM_API_KEY`, e.g. `OPENAI_API_KEY`, `GROQ_API_KEY`. Only read for the provider selected by `LLM_PROVIDER`. |
| `LLM_MODEL` | Override the preset's default model. |
| `LLM_BASE_URL` / `<PROVIDER>_BASE_URL` | Override the endpoint in self-host mode (vLLM, LM Studio, a proxy, a GPU box...). |
| `LLM_MAX_TOKENS` | Maximum tokens per answer, enforced by the server. Default `2048`, hard limit `8192`. |
| `LLM_ALLOW_CUSTOM_BASE_URL` | Set to `1` only on a private self-hosted instance. Lets the browser Settings use the local presets and a custom endpoint URL. **Do not set it on a public server**: it would let visitors make your server call any URL. |

Setting `LLM_PROVIDER=ollama` (or `llamacpp`) without a key also enables self-host mode, since local servers need no key.

## Supported providers

| Provider | `LLM_PROVIDER` | Default model | Auth header | Key variable | Available in BYO-key mode |
|----------|----------------|---------------|-------------|--------------|---------------------------|
| OpenAI | `openai` | `gpt-4o-mini` | `Authorization: Bearer` | `OPENAI_API_KEY` | Yes |
| OpenRouter | `openrouter` | `openai/gpt-4o-mini` | `Authorization: Bearer` | `OPENROUTER_API_KEY` | Yes |
| Groq | `groq` | `llama-3.3-70b-versatile` | `Authorization: Bearer` | `GROQ_API_KEY` | Yes |
| DeepSeek | `deepseek` | `deepseek-chat` | `Authorization: Bearer` | `DEEPSEEK_API_KEY` | Yes |
| Together AI | `together` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | `Authorization: Bearer` | `TOGETHER_API_KEY` | Yes |
| Mistral | `mistral` | `mistral-small-latest` | `Authorization: Bearer` | `MISTRAL_API_KEY` | Yes |
| Xiaomi MiMo | `mimo` | `mimo-v2.5-pro` | `api-key` | `MIMO_API_KEY` | Yes |
| Ollama (local) | `ollama` | `llama3.1` | none needed | `OLLAMA_API_KEY` (optional) | Only with `LLM_ALLOW_CUSTOM_BASE_URL=1` |
| llama.cpp server (local) | `llamacpp` | `default` | none needed | `LLAMACPP_API_KEY` (optional) | Only with `LLM_ALLOW_CUSTOM_BASE_URL=1` |

Default models are only starting points; type any model id your provider offers. Adding a provider is one entry in [`src/lib/providers.ts`](src/lib/providers.ts) (see [CONTRIBUTING.md](CONTRIBUTING.md)). When a model streams `reasoning_content`, the chat API forwards it as separate `reasoning` events; the UI shows only the answer.

## Errors you may see

Provider errors are translated into plain messages instead of raw API output:

| Provider says | StudyPal shows |
|---------------|----------------|
| 401 | "The provider rejected your key." |
| 403 | "The provider refused the request. Your key may not have access to this model." |
| 404 | "The provider could not find that model." |
| 429 | "...you hit a rate limit or ran out of credit." |
| 5xx / no answer | "The provider is having trouble right now." / "Could not reach the provider." |

A missing key opens Settings with "Add your API key in Settings to use StudyPal."

## API routes

Every POST body also accepts `"language": "en"` (default) or `"ms"`, the language the model must answer in. All routes accept the optional `x-llm-provider`, `x-llm-model`, `x-llm-key` (and, only with `LLM_ALLOW_CUSTOM_BASE_URL=1`, `x-llm-base-url`) headers described above. Errors are `{ "error": "<message>", "code": "<code>" }`, for example `missing_key` (400), `base_url_not_allowed` (400) or `invalid_key` (502). Full details: [docs/api-reference.md](docs/api-reference.md).

| Route | Body | Response |
|-------|------|----------|
| `POST /api/chat` | `{ "messages": [{ "role": "user", "content": "..." }], "topic": "optional", "language": "ms" }` | SSE |
| `POST /api/flashcards` | `{ "topic": "Cell biology", "count": 8, "difficulty": "mixed", "language": "en" }` | JSON |
| `POST /api/quiz` | `{ "topic": "Calculus", "count": 5, "difficulty": "mixed", "language": "en" }` | JSON |
| `POST /api/summarize` | `{ "content": "text...", "topic": "optional", "language": "ms" }` | SSE |
| `GET /api/config` | | Server mode (`byok` or `server`), never a key |

## Deploy to Vercel

Import the repository in Vercel, or run `npx vercel --prod`. With no environment variables the deployment works in bring-your-own-key mode, like the live demo. To use your own key for everyone instead, add `LLM_PROVIDER` and `LLM_API_KEY` in the project's environment variables (anyone who can reach the site can then spend your credit).

## Development

```bash
npm run dev         # dev server
npm test            # Jest: provider layer, API routes, settings UI, translations
npm run lint        # ESLint (eslint-config-next)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

Requires Node.js 20.9 or newer.

## Tech stack

- **Next.js 16** (App Router, Node.js route handlers), **React 19**, **TypeScript 5**
- **Tailwind CSS 4** (semantic colour tokens, light + dark), **lucide-react** icons, **Zustand** for client state, **react-markdown** for answers
- **Jest 30** + Testing Library

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # SSE chat
│   │   ├── config/route.ts        # server mode for the UI (no secrets)
│   │   ├── flashcards/route.ts    # flashcard generation
│   │   ├── quiz/route.ts          # quiz generation
│   │   └── summarize/route.ts     # SSE summary
│   ├── page.tsx                   # chat
│   ├── flashcards/ quiz/ summarize/ dashboard/
│   ├── layout.tsx
│   └── globals.css
├── components/                    # header, Settings dialog, notices, theme toggle
├── hooks/                         # session token stats, API calls with the language
├── i18n/                          # en.json + ms.json (all interface text), provider
└── lib/
    ├── providers.ts               # provider presets = base URL allowlist
    ├── llm-config.ts              # env vs header key resolution, SSRF guard, caps
    ├── llm.ts                     # OpenAI-compatible client (JSON + SSE)
    ├── llm-errors.ts              # friendly error mapping
    ├── api.ts                     # route helpers, validation, output parsing
    ├── prompts.ts                 # system prompts + answer-language rule
    ├── language.ts                # supported languages, browser-language detection
    ├── theme.ts                   # light / dark theme
    ├── store.ts                   # Zustand store
    └── client/                    # browser: settings storage + API calls
tests/                             # Jest
```

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability privately.

## License

MIT, see [LICENSE](LICENSE).

---

Built by [Sasa Teguh](https://sasateguh.com) · Malaysia
