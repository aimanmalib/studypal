/** Jest configuration for StudyPal (TypeScript via Babel). */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { configFile: './babel.config.test.js' }],
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
};
