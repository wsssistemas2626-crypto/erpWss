-- Schema do módulo partners (ADR-002: cada módulo é dono do seu schema).
-- Dono: app_owner. app_platform não entra aqui: ele só atravessa tenants na plataforma.
CREATE SCHEMA IF NOT EXISTS partners AUTHORIZATION app_owner;

GRANT USAGE ON SCHEMA partners TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA partners
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA partners
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
