import { TenantModuleService } from '@erp/platform-config';
import { AllowWithoutTenant } from '@erp/platform-http';
import type { MeResponse } from '@erp/shared-contracts';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { requireAuthContext, type AuthContext, type AuthenticatedTenant } from '../auth-context';
import { PermissionService } from '../rbac/permission-service';

/**
 * Quem sou eu, onde estou e o que posso fazer (ADR-004).
 *
 * É a única rota autenticada que responde sem organização ativa: é por ela que o front
 * descobre que precisa abrir o seletor de organização. Também é a fonte do menu lateral
 * (F0-13), por isso devolve as permissões efetivas e os módulos habilitados no tenant.
 */
@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly permissions: PermissionService,
    private readonly modules: TenantModuleService,
  ) {}

  @Get()
  @AllowWithoutTenant()
  @ApiOperation({ summary: 'Usuário autenticado, organização ativa, permissões e módulos' })
  async me(): Promise<MeResponse> {
    const auth = requireAuthContext();
    const { permissions, modules } = await this.capabilitiesOf(auth);

    return {
      user: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
      tenant: auth.tenant === undefined ? null : toTenantDto(auth.tenant),
      membershipStatus: auth.membershipStatus ?? null,
      permissions,
      modules,
    };
  }

  /**
   * Sem organização ativa, ou com vínculo revogado, não há o que o usuário possa fazer:
   * o front usa as listas vazias para cair no seletor de organização em vez do menu.
   */
  private async capabilitiesOf(
    auth: AuthContext,
  ): Promise<{ permissions: string[]; modules: string[] }> {
    if (
      auth.tenant === undefined ||
      auth.membershipId === undefined ||
      auth.membershipStatus !== 'ACTIVE' ||
      auth.tenant.status !== 'ACTIVE'
    ) {
      return { permissions: [], modules: [] };
    }

    const [permissions, modules] = await Promise.all([
      this.permissions.permissionsOf(auth.tenant.id, auth.membershipId),
      this.modules.enabledModulesOf(auth.tenant.id),
    ]);

    return { permissions: [...permissions].sort(), modules: [...modules] };
  }
}

function toTenantDto(tenant: AuthenticatedTenant) {
  return { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status };
}
