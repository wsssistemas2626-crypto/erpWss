import { config as loadDotenv } from 'dotenv';
import { bootstrapRoles } from './bootstrap';
import { runMigrations } from './migration-runner';

/**
 * Entrada do `pnpm db:migrate`.
 *
 * Passo 1 — cria as roles do ADR-001, com a conexão administrativa.
 * Passo 2 — aplica as migrations de cada módulo como `app_owner`, plataforma primeiro.
 *
 * As senhas das roles saem das próprias `DATABASE_URL_*`: assim a URL de conexão e a role
 * criada no banco nunca saem de sincronia.
 */
async function main(): Promise<void> {
  loadDotenv({ quiet: true });

  const adminUrl = requireEnv('DATABASE_URL_ADMIN');
  const ownerUrl = requireEnv('DATABASE_URL_OWNER');
  const appUrl = requireEnv('DATABASE_URL_APP');
  const platformUrl = requireEnv('DATABASE_URL_PLATFORM');

  await bootstrapRoles(adminUrl, {
    owner: passwordOf(ownerUrl, 'DATABASE_URL_OWNER'),
    app: passwordOf(appUrl, 'DATABASE_URL_APP'),
    platform: passwordOf(platformUrl, 'DATABASE_URL_PLATFORM'),
  });
  console.error('roles verificadas: app_owner, app_user, app_platform');

  const applied = await runMigrations(ownerUrl, {
    onApplied: ({ module, name }) => console.error(`aplicada ${module}/${name}`),
  });

  console.error(
    applied.length === 0
      ? 'nenhuma migration pendente: o banco já estava atualizado'
      : `${applied.length} migration(s) aplicada(s)`,
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `A variável ${name} não está definida. Copie o .env.example para .env na raiz do repositório.`,
    );
  }
  return value;
}

function passwordOf(connectionString: string, variableName: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`A variável ${variableName} não é uma URL de conexão válida.`);
  }

  const password = decodeURIComponent(url.password);
  if (password.length === 0) {
    throw new Error(`A variável ${variableName} não traz a senha da role.`);
  }
  return password;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
