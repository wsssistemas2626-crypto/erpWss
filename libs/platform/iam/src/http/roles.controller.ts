import {
  assignRolesSchema,
  createRoleSchema,
  paginated,
  paginationQuerySchema,
  updateRoleSchema,
  type AssignRoles,
  type CreateRole,
  type PaginatedResponse,
  type Role,
  type UpdateRole,
} from '@erp/shared-contracts';
import { zodPipe } from '@erp/platform-http';
import type { EntityId } from '@erp/shared-kernel';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { requireAuthContext } from '../auth-context';
import { AuthForbiddenError } from '../errors';
import type { RoleRecord } from '../rbac/permission-repository';
import { RoleService } from '../rbac/role-service';
import { RequirePermission } from './require-permission.decorator';

/** Papéis do tenant e atribuição a membros (F0-08). */
@ApiTags('roles')
@Controller()
export class RolesController {
  constructor(private readonly roles: RoleService) {}

  @Get('roles')
  @RequirePermission('platform.role.read')
  @ApiOperation({ summary: 'Lista os papéis do tenant' })
  async list(
    @Query(zodPipe(paginationQuerySchema)) query: { page: number; pageSize: number },
  ): Promise<PaginatedResponse<Role>> {
    const tenantId = this.tenantId();
    const all = await this.roles.list(tenantId);
    const offset = (query.page - 1) * query.pageSize;

    return paginated(all.slice(offset, offset + query.pageSize).map(toRoleDto), query, all.length);
  }

  @Post('roles')
  @RequirePermission('platform.role.create')
  @ApiOperation({ summary: 'Cria um papel' })
  async create(@Body(zodPipe(createRoleSchema)) body: CreateRole): Promise<Role> {
    const auth = requireAuthContext();
    return toRoleDto(await this.roles.create(this.tenantId(), body, auth.user.id));
  }

  @Put('roles/:id')
  @RequirePermission('platform.role.update')
  @ApiOperation({ summary: 'Altera um papel (exige a versão corrente)' })
  async update(
    @Param('id') id: EntityId,
    @Body(zodPipe(updateRoleSchema)) body: UpdateRole,
  ): Promise<Role> {
    const auth = requireAuthContext();
    return toRoleDto(await this.roles.update(this.tenantId(), id, body, auth.user.id));
  }

  @Delete('roles/:id')
  @RequirePermission('platform.role.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui um papel que não seja do sistema' })
  async remove(@Param('id') id: EntityId): Promise<void> {
    await this.roles.remove(this.tenantId(), id);
  }

  @Get('memberships/:id/roles')
  @RequirePermission('platform.membership.read')
  @ApiOperation({ summary: 'Papéis de um membro' })
  async membershipRoles(@Param('id') id: EntityId): Promise<{ roleIds: readonly EntityId[] }> {
    return { roleIds: await this.roles.listMembershipRoles(this.tenantId(), id) };
  }

  @Put('memberships/:id/roles')
  @RequirePermission('platform.membership.assign-role')
  @ApiOperation({ summary: 'Define os papéis de um membro' })
  async assignRoles(
    @Param('id') id: EntityId,
    @Body(zodPipe(assignRolesSchema)) body: AssignRoles,
  ): Promise<{ roleIds: readonly EntityId[] }> {
    return { roleIds: await this.roles.assignRoles(this.tenantId(), id, body) };
  }

  private tenantId(): EntityId {
    const auth = requireAuthContext();
    if (auth.tenant === undefined) {
      throw new AuthForbiddenError('platform.role.read');
    }
    return auth.tenant.id;
  }
}

function toRoleDto(role: RoleRecord): Role {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    version: role.version,
    permissions: [...role.permissions],
  };
}
