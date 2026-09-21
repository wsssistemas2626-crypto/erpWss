-- Registro de tenants e a primeira tabela sob RLS (F0-05, ADR-001).

-- tenants é global: é o próprio registro dos tenants, não tem tenant_id nem RLS.
-- Espelha uma Organization do Clerk (ADR-004); o status é controlado por nós.
CREATE TYPE platform.tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

CREATE TABLE platform.tenants (
  id           uuid                   PRIMARY KEY,
  clerk_org_id text                   NOT NULL UNIQUE,
  name         text                   NOT NULL,
  slug         text                   NOT NULL,
  status       platform.tenant_status NOT NULL DEFAULT 'ACTIVE',
  created_at   timestamptz            NOT NULL DEFAULT now()
);

-- A aplicação resolve o tenant pelo clerk_org_id a cada requisição, e provisiona
-- sob demanda no primeiro acesso (F0-11). Tenant não se apaga.
GRANT SELECT, INSERT, UPDATE ON platform.tenants TO app_user;
GRANT SELECT ON platform.tenants TO app_platform;

-- tenant_settings: parâmetros por tenant. Primeira tabela de negócio do sistema,
-- e o exemplo vivo do formato que todas as outras seguem.
CREATE TABLE platform.tenant_settings (
  id         uuid        PRIMARY KEY,
  tenant_id  uuid        NOT NULL REFERENCES platform.tenants (id),
  key        text        NOT NULL,
  value      jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  version    integer     NOT NULL DEFAULT 1,
  CONSTRAINT tenant_settings_tenant_key_unique UNIQUE (tenant_id, key)
);

-- Índice de tabela de negócio começa por tenant_id (ADR-001); o UNIQUE acima já serve.
SELECT platform.enable_tenant_rls('platform.tenant_settings');

GRANT SELECT, INSERT, UPDATE, DELETE ON platform.tenant_settings TO app_user;
