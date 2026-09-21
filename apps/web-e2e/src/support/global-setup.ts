import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { clerkSetup } from '@clerk/testing/playwright';
import type { FullConfig } from '@playwright/test';
import { loadE2eEnv } from './e2e-env';

/**
 * Preparação única da suíte, antes de qualquer teste.
 *
 * Três coisas, nesta ordem:
 *
 * 1. `clerkSetup` obtém o *testing token* da instância de desenvolvimento. É ele que
 *    desliga a proteção antirrobô do Clerk para as páginas do teste; sem isso o
 *    formulário de login trava num desafio que nenhum navegador automatizado resolve.
 * 2. `pnpm cli dev:seed` copia para o banco o usuário de teste e as organizações dele.
 *    O provisionamento sob demanda do F0-11 faria isso na primeira requisição, mas o
 *    seed torna o primeiro teste determinístico: os papéis padrão já existem quando a
 *    tela pede `GET /api/v1/me`.
 * 3. O worker sobe como processo filho. Ele não escuta porta nenhuma (é um consumidor
 *    de pg-boss), então não cabe no `webServer` do Playwright, que espera por uma URL.
 *
 * O retorno é o teardown: o Playwright chama a função devolvida ao fim da suíte.
 */
export default async function globalSetup(config: FullConfig): Promise<() => Promise<void>> {
  // `rootDir` é a pasta do playwright.config.ts: apps/web-e2e.
  const workspaceRoot = resolve(config.rootDir, '../..');
  const env = loadE2eEnv();

  await clerkSetup({ publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY });

  await run(workspaceRoot, 'pnpm', ['cli', 'dev:seed']);

  const worker = spawn('node', ['--enable-source-maps', 'dist/worker/apps/worker/src/main.js'], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: process.env,
  });

  return async () => {
    await stop(worker);
  };
}

function run(cwd: string, command: string, args: readonly string[]): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        done();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} falhou com código ${String(code)}`));
    });
  });
}

function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((done) => {
    child.once('exit', () => done());
    child.kill('SIGTERM');
  });
}
