import { RequirePermission, zodPipe } from '@erp/platform-http';
import {
  auditQuerySchema,
  paginated,
  type AuditQueryInput,
  type AuditRecordDto,
  type PaginatedResponse,
} from '@erp/shared-contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService, type AuditRecord } from '../audit-service';
import { AUDIT_TENANT_RESOLVER, type AuditTenantResolver } from './audit-tenant-resolver';
import { Inject } from '@nestjs/common';

/** Consulta da trilha de auditoria de uma entidade (F0-09). */
@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    @Inject(AUDIT_TENANT_RESOLVER) private readonly tenant: AuditTenantResolver,
  ) {}

  @Get()
  @RequirePermission('platform.audit.read')
  @ApiOperation({ summary: 'Histórico de alterações de uma entidade' })
  async byEntity(
    @Query(zodPipe(auditQuerySchema)) query: AuditQueryInput,
  ): Promise<PaginatedResponse<AuditRecordDto>> {
    const tenantId = this.tenant.currentTenantId();
    const { items, total } = await this.audit.findByEntity(tenantId, {
      entity: query.entity,
      entityId: query.entityId,
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    });

    return paginated(items.map(toDto), query, total);
  }
}

function toDto(record: AuditRecord): AuditRecordDto {
  return {
    id: record.id,
    occurredAt: record.occurredAt.toISOString(),
    userId: record.userId ?? null,
    correlationId: record.correlationId,
    module: record.module,
    entity: record.entity,
    entityId: record.entityId,
    action: record.action,
    before: record.before ?? null,
    after: record.after ?? null,
  };
}
