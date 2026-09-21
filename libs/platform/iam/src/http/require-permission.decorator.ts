import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION = 'erp:required-permission';

/**
 * Permissão exigida pela rota (CLAUDE.md §4.5), no formato `<modulo>.<recurso>.<acao>`.
 * Sem ela — e sem `@Public()` — uma rota de escrita é reprovada pelo teste de arquitetura.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
