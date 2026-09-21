import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Variáveis que só o E2E consome, validadas antes de subir qualquer processo.
 *
 * O E2E é o único teste do repositório que fala com o Clerk de verdade (ADR-004): o
 * `pnpm check` usa o `FakeIdentityProvider` e não acessa a rede. Por isso a checagem
 * mora aqui, e não em `@erp/platform-config` — e por isso ela também recusa os valores
 * de exemplo do `.env.example`: com eles o processo sobe e o teste falha lá na frente,
 * num erro de login que não diz que o problema era configuração.
 */
const IS_PLACEHOLDER: Readonly<Record<string, (value: string) => boolean>> = {
  // O `.env.example` traz o miolo da chave como "...": o dotenv já converteu os \n em
  // quebras de linha, então comparar a string inteira não serviria.
  CLERK_JWT_KEY: (value) => value.includes('...'),
  CLERK_SECRET_KEY: (value) => value === 'sk_test_xxx',
  VITE_CLERK_PUBLISHABLE_KEY: (value) => value === 'pk_test_xxx',
  E2E_CLERK_USER_EMAIL: (value) => value === 'e2e+clerk_test@example.com',
  E2E_CLERK_USER_PASSWORD: (value) => value === 'troque-esta-senha',
};

const e2eEnvSchema = z.object({
  CLERK_JWT_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  E2E_CLERK_USER_EMAIL: z.string().min(1),
  E2E_CLERK_USER_PASSWORD: z.string().min(1),
  /** Porta do front servido pelo Vite durante o E2E. */
  E2E_WEB_PORT: z.coerce.number().int().min(1).max(65535).default(5173),
  /** Porta da API. Espelha `API_PORT`, que é quem o processo da API lê. */
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type E2eEnv = z.infer<typeof e2eEnvSchema>;

let cached: E2eEnv | undefined;

/** Lê e valida o `.env` da raiz. Chamar mais de uma vez não custa nada. */
export function loadE2eEnv(): E2eEnv {
  if (cached !== undefined) {
    return cached;
  }
  // O `.env` é único e fica na raiz do monorepo (CLAUDE.md §6.1). O alvo `e2e` roda a
  // partir da raiz, mas `playwright test` chamado à mão roda de `apps/web-e2e`.
  loadDotenv({
    quiet: true,
    path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  });

  const parsed = e2eEnvSchema.safeParse(process.env);
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => {
        const name = issue.path.map(String).join('.');
        const missing = issue.code === 'invalid_type' && issue.input === undefined;
        return `${name}: ${missing ? 'variável ausente' : issue.message}`;
      });

  for (const [name, isPlaceholder] of Object.entries(IS_PLACEHOLDER)) {
    const current = process.env[name];
    if (current !== undefined && current.length > 0 && isPlaceholder(current)) {
      issues.push(`${name}: ainda está com o valor de exemplo do .env.example`);
    }
  }

  if (issues.length > 0 || !parsed.success) {
    throw new Error(
      [
        'O E2E precisa da instância de DESENVOLVIMENTO do Clerk e não pode rodar:',
        ...issues.map((issue) => `  - ${issue}`),
        'Preencha o .env da raiz com os valores do Dashboard do Clerk (API keys e a chave',
        'pública JWKS) e com o e-mail/senha de um usuário de teste que seja membro de uma',
        'organização de teste. Nunca use a instância de produção aqui.',
      ].join('\n'),
    );
  }

  cached = parsed.data;
  return cached;
}

/** Endereço do front durante o E2E. */
export function webBaseUrl(env: E2eEnv): string {
  return `http://localhost:${env.E2E_WEB_PORT}`;
}

/** Endereço da API durante o E2E. */
export function apiBaseUrl(env: E2eEnv): string {
  return `http://localhost:${env.API_PORT}`;
}
