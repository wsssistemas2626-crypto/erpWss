/**
 * Superfície pública de @erp/platform-config.
 * Carregamento e validação com zod das variáveis de ambiente, no boot de cada processo.
 */
export { EnvValidationError, loadDotenvOnce, loadEnv } from './env';

export {
  apiEnvSchema,
  baseEnvSchema,
  loadApiEnv,
  loadWorkerEnv,
  workerEnvSchema,
  type ApiEnv,
  type WorkerEnv,
} from './app-env';
