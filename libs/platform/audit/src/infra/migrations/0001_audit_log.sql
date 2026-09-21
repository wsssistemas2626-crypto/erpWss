-- Trilha de auditoria (F0-09, RNF030 a RNF033).
--
-- A role da aplicação recebe apenas SELECT e INSERT: sem UPDATE e sem DELETE, a trilha é
-- imutável para quem serve as requisições (RNF031). Corrigir auditoria é privilégio de
-- migration, não de código de aplicação.

CREATE TYPE platform.audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE');

CREATE TABLE platform.audit_log (
  id             uuid                  PRIMARY KEY,
  tenant_id      uuid                  NOT NULL REFERENCES platform.tenants (id),
  occurred_at    timestamptz           NOT NULL DEFAULT now(),
  -- Nulo em ação de sistema (worker, sincronização com o Clerk).
  user_id        uuid,
  correlation_id text,
  module         text                  NOT NULL,
  entity         text                  NOT NULL,
  entity_id      uuid                  NOT NULL,
  action         platform.audit_action NOT NULL,
  -- Campos marcados como PII vão mascarados (ver AuditService).
  before         jsonb,
  after          jsonb
);

SELECT platform.enable_tenant_rls('platform.audit_log');

-- O schema platform concede DML completo por privilégio padrão. Aqui isso é revogado e
-- reconcedido só o que a trilha admite: escrever e ler, nunca alterar nem apagar (RNF031).
REVOKE ALL ON platform.audit_log FROM app_user, app_platform;
GRANT SELECT, INSERT ON platform.audit_log TO app_user, app_platform;

-- A consulta da tela de auditoria: histórico de uma entidade, do mais recente ao mais antigo.
CREATE INDEX audit_log_tenant_entity_idx
  ON platform.audit_log (tenant_id, entity, entity_id, occurred_at DESC);
