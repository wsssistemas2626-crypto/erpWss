/**
 * Pool usado pelo controller de webhook para a idempotência por `svix-id`.
 * É um token próprio para a lib não depender de um token da composição da API.
 */
export const DB_POOL_FOR_WEBHOOKS = Symbol('DB_POOL_FOR_WEBHOOKS');
