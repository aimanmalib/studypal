# Contributing to StudyPal

Thanks for your interest in improving StudyPal, a provider-agnostic AI study
assistant (Next.js + TypeScript) that runs on any OpenAI-compatible LLM
endpoint. Docs fixes, provider presets, UI improvements and bug reports are
all welcome.

## Getting started

```bash
git clone https://github.com/aimanmalib/studypal.git
cd studypal
npm install

cp .env.example .env.local   # optional: add a server key, or leave empty
npm run dev                  # http://localhost:3000
```

With no key in `.env.local`, open **Settings** in the app and paste your own
key (bring-your-own-key mode).

## Development workflow

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Make your change with tests.
3. Run the same checks as CI before pushing:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `ci:`).
5. Open a pull request against `main`. CI runs on Node 22 and 24.

## Adding an LLM provider

Most OpenAI-compatible providers need only a preset in
`src/lib/providers.ts`:

```ts
myprovider: {
  label: 'My Provider',
  baseUrl: 'https://api.myprovider.com/v1', // also becomes an allowlisted URL
  authStyle: 'bearer',                       // 'bearer' or 'api-key'
  defaultModel: 'default-model-name',
  envKey: 'MYPROVIDER_API_KEY',
  envBase: 'MYPROVIDER_BASE_URL',
  requiresKey: true,
  local: false,                              // true only for localhost servers
  keyUrl: 'https://myprovider.com/keys',     // optional, shown in Settings
},
```

Then update the expected preset list in `tests/providers.test.ts` and the
provider table in `README.md`.

Rules for the API layer:

- Every route resolves its provider with `resolveRequestConfig()` and calls
  the provider only through `src/lib/llm.ts`.
- Never log, store or return an API key, and never echo a provider's error
  body to the client (use `upstreamError()`).
- The server may only call preset base URLs unless
  `LLM_ALLOW_CUSTOM_BASE_URL=1`.

## Code style

- TypeScript strict mode, Next.js App Router conventions
- Small, focused components; user-facing text in plain language
- Interface text goes in `src/i18n/en.json` **and** `src/i18n/ms.json` (same key in both; standard Malaysian Bahasa Melayu, not Indonesian), never directly in a component. `npm test` checks this
- Colours come from the semantic tokens in `src/app/globals.css` (`bg-surface`, `text-muted`…), so light and dark themes stay in step

## Reporting bugs and requesting features

Use the issue templates. For bugs include repro steps, your provider/model and
your browser or Node version. Security problems: see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree your contributions are licensed under the MIT
License, the same as the project.
