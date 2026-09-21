import { defineConfig } from 'drizzle-kit';

/**
 * Configuração do drizzle-kit para o schema da plataforma.
 *
 * `drizzle-kit generate` escreve o SQL em `src/infra/migrations`, a mesma pasta que o
 * `pnpm db:migrate` aplica. Cada módulo ganha um arquivo destes quando tiver a primeira tabela.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/schema.ts',
  out: './src/infra/migrations',
  schemaFilter: ['platform'],
  dbCredentials: {
    url: process.env['DATABASE_URL_OWNER'] ?? '',
  },
});
