import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// swc (e não esbuild) porque o NestJS depende de `emitDecoratorMetadata`.
export default defineConfig({
  // Vite 8 resolve os aliases @erp/* do tsconfig nativamente.
  resolve: { tsconfigPaths: true },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Os testes de integração sobem um Postgres real via Testcontainers.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
