-- Usuários e vínculos (F0-07, ADR-004).
--
-- Espelho local do Clerk: só id externo, nome, e-mail e status. Nada de senha nem de
-- dado de sessão — isso é do Clerk. A cópia local existe para dar join, auditar e
-- resolver RBAC sem ida à rede a cada requisição.

-- citext é extensão confiável no PostgreSQL: a dona do banco cria sem ser superusuária.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE platform.user_status AS ENUM ('ACTIVE', 'DELETED');

-- users é global, como tenants: um usuário pode pertencer a vários tenants.
CREATE TABLE platform.users (
  id            uuid                 PRIMARY KEY,
  clerk_user_id text                 NOT NULL UNIQUE,
  email         citext               NOT NULL,
  name          text                 NOT NULL,
  status        platform.user_status NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz          NOT NULL DEFAULT now(),
  updated_at    timestamptz          NOT NULL DEFAULT now()
);

-- Usuário excluído no Clerk vira DELETED; a linha nunca some, por causa da auditoria.
GRANT SELECT, INSERT, UPDATE ON platform.users TO app_user;
GRANT SELECT ON platform.users TO app_platform;

CREATE TYPE platform.membership_status AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE platform.memberships (
  id                  uuid                       PRIMARY KEY,
  tenant_id           uuid                       NOT NULL REFERENCES platform.tenants (id),
  user_id             uuid                       NOT NULL REFERENCES platform.users (id),
  clerk_membership_id text                       NOT NULL UNIQUE,
  status              platform.membership_status NOT NULL DEFAULT 'ACTIVE',
  created_at          timestamptz                NOT NULL DEFAULT now(),
  updated_at          timestamptz                NOT NULL DEFAULT now(),
  CONSTRAINT memberships_tenant_user_unique UNIQUE (tenant_id, user_id)
);

SELECT platform.enable_tenant_rls('platform.memberships');

GRANT SELECT, INSERT, UPDATE ON platform.memberships TO app_user;
