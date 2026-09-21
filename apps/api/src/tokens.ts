/** Tokens de injeção da composição da API. */
export const DB_POOL = Symbol('DB_POOL');
/**
 * Conexão como `app_platform`, para as rotinas de plataforma que atravessam tenants
 * (sincronização com o provedor de identidade). Nunca usada por caso de uso de negócio.
 */
export const PLATFORM_DB_POOL = Symbol('PLATFORM_DB_POOL');
export const API_ENV = Symbol('API_ENV');
export const LOGGER = Symbol('LOGGER');
