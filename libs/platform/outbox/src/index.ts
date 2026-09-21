/**
 * Superfície pública de @erp/platform-outbox.
 * Outbox transacional, publicador e base dos consumidores idempotentes (ADR-003).
 */
export {
  EVENT_BUS,
  EVENT_TYPE,
  type EventBus,
  type EventEnvelope,
  type EventHandler,
} from './event';

export { EVENT_TYPE_INVALID, OutboxWriter, type OutboxEventInput } from './outbox-writer';

export {
  MAX_PUBLISH_ATTEMPTS,
  OutboxPublisher,
  backoffSeconds,
  type OutboxPublisherOptions,
  type PublishBatchResult,
} from './outbox-publisher';

export { IdempotentConsumer, type ConsumeOutcome } from './idempotent-consumer';

export {
  PGBOSS_SCHEMA,
  PgBossEventBus,
  queueNameOf,
  type PgBossEventBusOptions,
} from './pg-boss-event-bus';
