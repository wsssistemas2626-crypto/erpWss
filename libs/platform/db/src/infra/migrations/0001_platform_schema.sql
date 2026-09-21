-- Schema da plataforma (ADR-001).
-- Dono: app_owner. app_user e app_platform só recebem USAGE e DML; criar objetos é só do dono.
CREATE SCHEMA IF NOT EXISTS platform AUTHORIZATION app_owner;

GRANT USAGE ON SCHEMA platform TO app_user, app_platform;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA platform
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, app_platform;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA platform
  GRANT USAGE, SELECT ON SEQUENCES TO app_user, app_platform;
