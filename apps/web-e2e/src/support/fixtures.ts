import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as base, type Page } from '@playwright/test';
import { loadE2eEnv, type E2eEnv } from './e2e-env';

export interface E2eFixtures {
  /** Variáveis já validadas: o teste não lê `process.env` direto. */
  env: E2eEnv;
  /** Página com o testing token do Clerk já instalado. */
  page: Page;
  /** Entra com o usuário de teste e devolve a página já dentro do sistema. */
  signIn: () => Promise<void>;
}

/**
 * `test` da suíte E2E.
 *
 * Toda página nasce com o testing token do Clerk (`setupClerkTestingToken`): ele vai num
 * cabeçalho por requisição e é o que permite ao navegador automatizado passar pela
 * proteção antirrobô da instância de desenvolvimento. Sem ele o login trava no desafio.
 */
export const test = base.extend<E2eFixtures>({
  // O Playwright exige o primeiro parâmetro mesmo quando a fixture não depende de nada.
  // eslint-disable-next-line no-empty-pattern
  env: async ({}, use) => {
    await use(loadE2eEnv());
  },

  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page });
    await use(page);
  },

  signIn: async ({ page, env }, use) => {
    await use(async () => {
      // O Clerk só carrega dentro da aplicação: `clerk.signIn` precisa de uma página do
      // app aberta, e `/entrar` é pública.
      await page.goto('/entrar');
      await clerk.loaded({ page });
      await clerk.signIn({
        page,
        signInParams: {
          strategy: 'password',
          identifier: env.E2E_CLERK_USER_EMAIL,
          password: env.E2E_CLERK_USER_PASSWORD,
        },
      });
    });
  },
});

export { expect } from '@playwright/test';
