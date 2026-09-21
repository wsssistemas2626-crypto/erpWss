-- Idempotência dos webhooks do provedor de identidade (F0-11, ADR-004).
--
-- Global, sem tenant_id e sem RLS: o webhook chega antes de existir tenant — é ele que
-- cria o tenant. A chave é o `svix-id`, que o provedor repete em cada reentrega.
CREATE TABLE platform.processed_webhooks (
  svix_id      text        PRIMARY KEY,
  event_type   text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON platform.processed_webhooks TO app_user;
