import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'erp:is-public';
export const ALLOWS_WITHOUT_TENANT = 'erp:allows-without-tenant';

/**
 * Rota sem autenticação. Só o webhook do Clerk e as sondas de saúde (CLAUDE.md §4.5).
 * O guard nega por padrão: esquecer o decorator fecha a rota, não abre.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Rota que responde mesmo sem organização ativa na sessão.
 * Só o `GET /api/v1/me` (ADR-004): é ele que diz ao front que falta escolher organização.
 */
export const AllowWithoutTenant = () => SetMetadata(ALLOWS_WITHOUT_TENANT, true);
