import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts']),
  {
    // CommonJS config files at the repo root.
    files: ['*.config.js', 'babel.config.test.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
