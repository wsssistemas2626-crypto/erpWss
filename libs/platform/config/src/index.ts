/**
 * Superfície pública de @erp/platform-config.
 * Carregamento e validação com zod das variáveis de ambiente, no boot de cada processo,
 * e a configuração por tenant que vive no banco: quais módulos estão habilitados.
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

export {
  MODULE_CATALOG,
  MODULE_KEY,
  ModuleCatalog,
  type ModuleDefinition,
} from './modules/module-catalog';

export { MODULE_UNKNOWN, TenantModuleService } from './modules/tenant-module-service';

export { tenantModules } from './infra/schema';
