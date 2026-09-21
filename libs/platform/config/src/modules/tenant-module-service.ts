import type { AuditService } from '@erp/platform-audit';
import { TenantDb, runInTenantContext, type TenantTransaction } from '@erp/platform-tenancy';
import { DomainError, newId, type EntityId } from '@erp/shared-kernel';
import type { ModuleCatalog } from './module-catalog';

export const MODULE_UNKNOWN = 'MODULE_UNKNOWN';

/** Módulo dono da entidade na trilha de auditoria (CLAUDE.md §4.5). */
const AUDIT_MODULE = 'platform';
const AUDIT_ENTITY = 'tenant_module';

interface TenantModuleRow {
  readonly id: EntityId;
  readonly enabled: boolean;
}

/**
 * Quais módulos do catálogo estão habilitados num tenant (docs/dominio/platform.md).
 *
 * O catálogo é a lista do que a instalação oferece; a tabela `platform.tenant_modules`
 * guarda só os desvios. Assim um tenant novo já nasce com tudo, e desabilitar um módulo
 * é uma linha explícita — que o item de menu some é consequência disso (F0-13).
 */
export class TenantModuleService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly catalog: ModuleCatalog,
    private readonly audit: AuditService,
  ) {}

  async enabledModulesOf(tenantId: EntityId): Promise<readonly string[]> {
    const disabled = await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx((tx) => findDisabledModules(tx)),
    );

    return this.catalog.keys().filter((key) => !disabled.has(key));
  }

  async isEnabled(tenantId: EntityId, module: string): Promise<boolean> {
    return (await this.enabledModulesOf(tenantId)).includes(module);
  }

  /**
   * Habilita ou desabilita um módulo no tenant, com registro de auditoria na mesma
   * transação. Módulo fora do catálogo desta instalação é recusado.
   */
  async setEnabled(
    tenantId: EntityId,
    module: string,
    enabled: boolean,
    userId?: EntityId,
  ): Promise<void> {
    if (!this.catalog.has(module)) {
      throw new DomainError(
        MODULE_UNKNOWN,
        `Módulo "${module}" não existe no catálogo desta instalação.`,
        { module },
      );
    }

    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const before = await findModuleRow(tx, module);
        // Ausência de linha significa habilitado: gravar "habilitado" de novo não é mudança.
        if ((before?.enabled ?? true) === enabled) {
          return;
        }

        const id = before?.id ?? newId();
        await tx.client.query(
          `insert into platform.tenant_modules (id, tenant_id, module, enabled, created_by, updated_by)
                values ($1, $2, $3, $4, $5, $5)
           on conflict (tenant_id, module)
             do update set enabled = excluded.enabled,
                           updated_at = now(),
                           updated_by = excluded.updated_by,
                           version = platform.tenant_modules.version + 1`,
          [id, tenantId, module, enabled, userId ?? null],
        );

        await this.audit.record(tx, {
          module: AUDIT_MODULE,
          entity: AUDIT_ENTITY,
          entityId: id,
          action: before === undefined ? 'CREATE' : 'UPDATE',
          userId,
          before: before === undefined ? null : { module, enabled: before.enabled },
          after: { module, enabled },
        });
      }),
    );
  }
}

async function findDisabledModules(tx: TenantTransaction): Promise<ReadonlySet<string>> {
  const result = await tx.client.query<{ module: string }>(
    'select module from platform.tenant_modules where enabled = false',
  );
  return new Set(result.rows.map((row) => row.module));
}

async function findModuleRow(
  tx: TenantTransaction,
  module: string,
): Promise<TenantModuleRow | undefined> {
  const result = await tx.client.query<TenantModuleRow>(
    'select id, enabled from platform.tenant_modules where module = $1',
    [module],
  );
  return result.rows[0];
}
