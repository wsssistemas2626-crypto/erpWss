/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Vite 8 resolve os aliases @erp/* do tsconfig nativamente.
  resolve: { tsconfigPaths: true },
  // O .env é único e fica na raiz do monorepo, não em apps/web (CLAUDE.md §6.1).
  envDir: '../../',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // O front chama `/api/v1/...` relativo; em desenvolvimento quem responde é a API.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: { outDir: '../../dist/apps/web', emptyOutDir: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
