import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// swc (e não esbuild) porque o NestJS depende de `emitDecoratorMetadata`,
// que o esbuild usado pelo Vite não suporta.
export default defineConfig({
  // Vite 8 resolve os aliases @erp/* do tsconfig nativamente.
  resolve: { tsconfigPaths: true },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
