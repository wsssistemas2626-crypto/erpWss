-- RBAC local (F0-08, ADR-004): papéis e permissões vivem aqui, nunca no token do Clerk.
--
-- As três tabelas carregam tenant_id e RLS: papéis são configuráveis por tenant, e o
-- conjunto de papéis de um tenant não pode ser visto nem alterado por outro.

CREATE TABLE platform.roles (
  id          uuid        PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES platform.tenants (id),
  name        text        NOT NULL,
  description text,
  -- Papéis semeados em todo tenant novo. Não podem ser excluídos nem renomeados.
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  version     integer     NOT NULL DEFAULT 1,
  CONSTRAINT roles_tenant_name_unique UNIQUE (tenant_id, name)
);

SELECT platform.enable_tenant_rls('platform.roles');
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.roles TO app_user;

CREATE TABLE platform.role_permissions (
  tenant_id  uuid NOT NULL REFERENCES platform.tenants (id),
  role_id    uuid NOT NULL REFERENCES platform.roles (id) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (tenant_id, role_id, permission)
);

SELECT platform.enable_tenant_rls('platform.role_permissions');
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.role_permissions TO app_user;

CREATE TABLE platform.membership_roles (
  tenant_id     uuid NOT NULL REFERENCES platform.tenants (id),
  membership_id uuid NOT NULL REFERENCES platform.memberships (id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES platform.roles (id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, membership_id, role_id)
);

SELECT platform.enable_tenant_rls('platform.membership_roles');
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.membership_roles TO app_user;

-- A consulta quente do guard: permissões de um membership.
CREATE INDEX membership_roles_tenant_membership_idx
  ON platform.membership_roles (tenant_id, membership_id);
