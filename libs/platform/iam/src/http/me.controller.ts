import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { requireAuthContext, type AuthenticatedTenant } from '../auth-context';
import { AllowWithoutTenant } from './public.decorator';

export interface MeResponse {
  readonly user: { readonly id: string; readonly email: string; readonly name: string };
  readonly tenant: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly status: string;
  } | null;
  /** Estado do vínculo com a organização ativa. `null` quando não há organização. */
  readonly membershipStatus: string | null;
}

/**
 * Quem sou eu e em qual organização estou (ADR-004).
 *
 * É a única rota autenticada que responde sem organização ativa: é por ela que o front
 * descobre que precisa abrir o seletor de organização.
 */
@ApiTags('me')
@Controller('me')
export class MeController {
  @Get()
  @AllowWithoutTenant()
  @ApiOperation({ summary: 'Usuário autenticado e organização ativa' })
  me(): MeResponse {
    const auth = requireAuthContext();

    return {
      user: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
      tenant: auth.tenant === undefined ? null : toTenantDto(auth.tenant),
      membershipStatus: auth.membershipStatus ?? null,
    };
  }
}

function toTenantDto(tenant: AuthenticatedTenant) {
  return { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status };
}
