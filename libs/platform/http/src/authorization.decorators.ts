import { SetMetadata } from '@nestjs/common';

/**
 * Marcadores de autorização das rotas.
 *
 * Ficam aqui, e não em `platform/iam`, porque são só metadados de HTTP: os guards que os
 * leem vivem no IAM, mas qualquer lib com controller precisa declará-los — e o IAM audita
 * as próprias mudanças de papel, então ele depende de `platform/audit`. Decorators no IAM
 * fechariam um ciclo entre as duas libs.
 */

export const IS_PUBLIC = 'erp:is-public';
export const ALLOWS_WITHOUT_TENANT = 'erp:allows-without-tenant';
export const REQUIRED_PERMISSION = 'erp:required-permission';

/** Rota sem autenticação. Só webhook e sondas de saúde (CLAUDE.md §4.5). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Rota que responde mesmo sem organização ativa na sessão.
 * Só o `GET /api/v1/me` (ADR-004): é ele que diz ao front que falta escolher organização.
 */
export const AllowWithoutTenant = () => SetMetadata(ALLOWS_WITHOUT_TENANT, true);

/** Permissão exigida pela rota, no formato `<modulo>.<recurso>.<acao>`. */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
