-- Schema do módulo organization (ADR-002: cada módulo é dono do seu schema).
-- Dono: app_owner. app_platform não entra aqui: ele só atravessa tenants na plataforma.
CREATE SCHEMA IF NOT EXISTS organization AUTHORIZATION app_owner;

GRANT USAGE ON SCHEMA organization TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA organization
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA organization
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
