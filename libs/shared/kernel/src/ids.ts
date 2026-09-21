import { v7 as uuidV7, validate as uuidValidate, version as uuidVersion } from 'uuid';

/**
 * Identificadores de entidade: uuid v7, gerado na aplicação (CLAUDE.md §5).
 * A v7 carrega o timestamp no prefixo, então as chaves crescem em ordem temporal
 * e os índices B-tree do Postgres não fragmentam como com a v4.
 */
export type EntityId = string;

export function newId(): EntityId {
  return uuidV7();
}

export function isEntityId(value: string): boolean {
  return uuidValidate(value) && uuidVersion(value) === 7;
}
