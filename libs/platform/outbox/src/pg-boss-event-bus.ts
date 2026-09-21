import type { Logger } from '@erp/platform-observability';
import { PgBoss } from 'pg-boss';
import type { EventBus, EventEnvelope, EventHandler } from './event';

/** Schema criado pela migration; o worker só precisa de USAGE e CREATE nele. */
export const PGBOSS_SCHEMA = 'pgboss';

export interface PgBossEventBusOptions {
  readonly connectionString: string;
  readonly schema?: string;
  readonly applicationName?: string;
}

/**
 * Bus sobre pg-boss (ADR-003): uma fila por tipo de evento, no próprio Postgres.
 *
 * `createSchema: false` porque o schema vem da migration, feita pela dona do banco — assim
 * o worker roda com `app_platform` e não precisa de permissão para criar schema.
 */
export class PgBossEventBus implements EventBus {
  private readonly boss: PgBoss;
  private readonly queues = new Set<string>();

  constructor(
    options: PgBossEventBusOptions,
    private readonly logger: Logger,
  ) {
    this.boss = new PgBoss({
      connectionString: options.connectionString,
      schema: options.schema ?? PGBOSS_SCHEMA,
      application_name: options.applicationName ?? 'erp-worker',
      createSchema: false,
      migrate: true,
    });
    this.boss.on('error', (error: unknown) => {
      this.logger.error({ err: error }, 'erro no pg-boss');
    });
  }

  async start(): Promise<void> {
    await this.boss.start();
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, close: true });
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    const queue = queueNameOf(envelope.type);
    await this.ensureQueue(queue);
    await this.boss.send(queue, { ...envelope, occurredAt: envelope.occurredAt.toISOString() });
  }

  async subscribe(type: string, handler: EventHandler): Promise<void> {
    const queue = queueNameOf(type);
    await this.ensureQueue(queue);
    await this.boss.work<Record<string, unknown>>(queue, async (jobs) => {
      for (const job of jobs) {
        await handler(fromJob(job.data));
      }
    });
  }

  private async ensureQueue(queue: string): Promise<void> {
    if (this.queues.has(queue)) {
      return;
    }
    await this.boss.createQueue(queue);
    this.queues.add(queue);
  }
}

/** `projects.timesheet-entry.approved.v1` vira `projects-timesheet-entry-approved-v1`. */
export function queueNameOf(eventType: string): string {
  return eventType.replace(/\./g, '-');
}

function fromJob(data: Record<string, unknown>): EventEnvelope {
  return {
    id: String(data['id']),
    tenantId: String(data['tenantId']),
    type: String(data['type']),
    payload: (data['payload'] ?? {}) as Record<string, unknown>,
    occurredAt: new Date(String(data['occurredAt'])),
  };
}
