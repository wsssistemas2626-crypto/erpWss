-- Outbox transacional e idempotência dos consumidores (F0-10, ADR-003).

CREATE TABLE platform.outbox_events (
  id               uuid        PRIMARY KEY,
  tenant_id        uuid        NOT NULL REFERENCES platform.tenants (id),
  -- <modulo>.<entidade>.<fato-no-passado>.v<N> (CLAUDE.md §5)
  type             text        NOT NULL,
  payload          jsonb       NOT NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz,
  attempts         integer     NOT NULL DEFAULT 0,
  last_error       text,
  -- Backoff exponencial entre tentativas.
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  -- Depois de 10 falhas o evento sai da fila e espera intervenção humana.
  dead_lettered_at timestamptz
);

SELECT platform.enable_tenant_rls('platform.outbox_events');

-- O publicador atravessa tenants, por definição: ele drena a outbox inteira. É a exceção
-- que o ADR-001 prevê, e ela é concedida a uma role separada, restrita à plataforma —
-- não a `BYPASSRLS`, que valeria para todas as tabelas do banco.
CREATE POLICY outbox_publisher ON platform.outbox_events
  FOR ALL TO app_platform
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON platform.outbox_events TO app_user;
GRANT SELECT, UPDATE ON platform.outbox_events TO app_platform;

-- A varredura do publicador: pendentes, na ordem em que aconteceram.
CREATE INDEX outbox_events_pending_idx
  ON platform.outbox_events (next_attempt_at, occurred_at)
  WHERE published_at IS NULL AND dead_lettered_at IS NULL;

-- Idempotência: o par (consumidor, evento) grava junto com o efeito, na mesma transação.
CREATE TABLE platform.processed_events (
  consumer_name text        NOT NULL,
  event_id      uuid        NOT NULL,
  tenant_id     uuid        NOT NULL REFERENCES platform.tenants (id),
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);

SELECT platform.enable_tenant_rls('platform.processed_events');

REVOKE ALL ON platform.processed_events FROM app_user, app_platform;
GRANT SELECT, INSERT ON platform.processed_events TO app_user, app_platform;

-- O pg-boss guarda as filas no schema próprio. Criado aqui, pela dona do banco, para que
-- o worker (app_platform) não precise de permissão para criar schema.
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION app_owner;
GRANT USAGE, CREATE ON SCHEMA pgboss TO app_platform;
