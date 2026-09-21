-- Módulos habilitados por tenant (F0-13; docs/dominio/platform.md, seção tenant_modules).
--
-- A linha existe só para registrar um desvio do padrão: o catálogo de módulos do produto
-- vive no código (`ModuleCatalog`, preenchido na composição da API) e todo módulo do
-- catálogo nasce habilitado. Desabilitar um módulo num tenant é que grava uma linha aqui.
CREATE TABLE platform.tenant_modules (
  id         uuid        PRIMARY KEY,
  tenant_id  uuid        NOT NULL REFERENCES platform.tenants (id),
  module     text        NOT NULL,
  enabled    boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version    integer     NOT NULL DEFAULT 1,
  CONSTRAINT tenant_modules_tenant_module_unique UNIQUE (tenant_id, module)
);

-- O UNIQUE acima já começa por tenant_id, que é o índice que o ADR-001 exige.
SELECT platform.enable_tenant_rls('platform.tenant_modules');

GRANT SELECT, INSERT, UPDATE, DELETE ON platform.tenant_modules TO app_user;
