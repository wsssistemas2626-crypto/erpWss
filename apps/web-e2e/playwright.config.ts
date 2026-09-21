import { defineConfig, devices } from '@playwright/test';
import { apiBaseUrl, loadE2eEnv, webBaseUrl } from './src/support/e2e-env';

const env = loadE2eEnv();
const isCi = process.env['CI'] === 'true' || process.env['CI'] === '1';

/**
 * Suíte E2E (F0-14).
 *
 * Sobe o sistema como ele roda de verdade: API e worker compilados (não `tsx` — o Nest
 * depende de `emitDecoratorMetadata`, que os transpiladores rápidos não emitem), front
 * pelo Vite com o proxy de `/api`, e Postgres pelo compose. O alvo `e2e` do
 * `project.json` faz o que precisa vir antes: compose, migrations e build.
 *
 * O worker não entra aqui porque não escuta porta: quem o sobe é o `globalSetup`.
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  globalSetup: './src/support/global-setup.ts',
  // O login real do Clerk é lento; o padrão de 30 s reprova por tempo, não por defeito.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: webBaseUrl(env),
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'node --enable-source-maps dist/api/apps/api/src/main.js',
      url: `${apiBaseUrl(env)}/api/v1/ready`,
      cwd: '../..',
      reuseExistingServer: !isCi,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
    {
      command: `vite --port ${String(env.E2E_WEB_PORT)} --strictPort`,
      url: webBaseUrl(env),
      cwd: '../web',
      reuseExistingServer: !isCi,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
});
