import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Cada caso roda o ESLint num processo próprio.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
