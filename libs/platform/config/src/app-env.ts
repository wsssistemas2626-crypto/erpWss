import { z } from 'zod';
import { loadDotenvOnce, loadEnv } from './env';

const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');
const nodeEnv = z.enum(['development', 'test', 'production']).default('development');

/** Variáveis comuns a todo processo do backend. */
export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
});

/** Lista separada por vírgula vira array, descartando espaços e entradas vazias. */
const commaSeparated = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

export const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535),
  /** Conexão como `app_user`: sujeita à RLS (ADR-001). A API nunca usa a conexão dona. */
  DATABASE_URL_APP: z.string().min(1),
  /** Chave pública do Clerk: torna a verificação do token networkless (ADR-004). */
  CLERK_JWT_KEY: z.string().min(1),
  /** Backend API do Clerk, usada no provisionamento sob demanda. */
  CLERK_SECRET_KEY: z.string().min(1),
  /** Origens aceitas no claim `azp` do token. */
  CLERK_AUTHORIZED_PARTIES: commaSeparated,
});

export const workerEnvSchema = baseEnvSchema.extend({
  WORKER_NAME: z.string().min(1),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadApiEnv(source?: NodeJS.ProcessEnv): ApiEnv {
  if (source === undefined) {
    loadDotenvOnce();
  }
  return loadEnv(apiEnvSchema, source);
}

export function loadWorkerEnv(source?: NodeJS.ProcessEnv): WorkerEnv {
  if (source === undefined) {
    loadDotenvOnce();
  }
  return loadEnv(workerEnvSchema, source);
}
