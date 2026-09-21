import { z } from 'zod';
import { loadDotenvOnce, loadEnv } from './env';

const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');
const nodeEnv = z.enum(['development', 'test', 'production']).default('development');

/** Variáveis comuns a todo processo do backend. */
export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
});

export const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535),
  /** Conexão como `app_user`: sujeita à RLS (ADR-001). A API nunca usa a conexão dona. */
  DATABASE_URL_APP: z.string().min(1),
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
