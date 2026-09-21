import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { createLogger } from '@erp/platform-observability';
import { runInTenantContext, TenantDb, type TenantTransaction } from '@erp/platform-tenancy';
import { withTenantSession } from '@erp/platform-tenancy/testing';
import { newId, type EntityId } from '@erp/shared-kernel';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EventEnvelope } from './event';
import { IdempotentConsumer } from './idempotent-consumer';
import { OutboxPublisher, backoffSeconds } from './outbox-publisher';
import { OutboxWriter } from './outbox-writer';
import { InMemoryEventBus } from './testing';

const TENANT_A: EntityId = newId();
const TENANT_B: EntityId = newId();
const EVENT_TYPE = 'projects.timesheet-entry.approved.v1';

let env: PostgresTestEnv;
let tenantDb: TenantDb;
let writer: OutboxWriter;

const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const logger = createLogger({ name: 'test', level: 'fatal', destination: discard });

/** Consumidor de exemplo: grava uma configuração do tenant a cada evento. */
class SettingsConsumer extends IdempotentConsumer {
  readonly name: string = 'settings-consumer';
  readonly eventType = EVENT_TYPE;
  readonly handled: EventEnvelope[] = [];

  protected async handle(tx: TenantTransaction, envelope: EventEnvelope): Promise<void> {
    this.handled.push(envelope);
    await tx.client.query(
      `insert into platform.tenant_settings (id, tenant_id, key, value)
       values ($1, $2, $3, $4)`,
      [newId(), tx.tenantId, `${this.name}-${envelope.id}`, JSON.stringify(envelope.payload)],
    );
  }
}

beforeAll(async () => {
  env = await startPostgresTestEnv();
  tenantDb = new TenantDb(env.appPool);
  writer = new OutboxWriter();

  await env.ownerPool.query(
    `insert into platform.tenants (id, clerk_org_id, name, slug)
     values ($1, 'org_a', 'A', 'a'), ($2, 'org_b', 'B', 'b')`,
    [TENANT_A, TENANT_B],
  );
});

afterAll(async () => {
  await env?.stop();
});

beforeEach(async () => {
  // TRUNCATE não passa pela RLS; um DELETE exigiria declarar o tenant a cada limpeza.
  await env.ownerPool.query('truncate platform.outbox_events, platform.processed_events');
});

function append(tenantId: EntityId, payload: Record<string, unknown>): Promise<EntityId> {
  return runInTenantContext({ tenantId }, () =>
    tenantDb.withTenantTx((tx) => writer.append(tx, { type: EVENT_TYPE, payload })),
  );
}

describe('F0-10 evento só existe se a transação confirmar', () => {
  it('rollback da transação não deixa evento na outbox', async () => {
    await expect(
      runInTenantContext({ tenantId: TENANT_A }, () =>
        tenantDb.withTenantTx(async (tx) => {
          await writer.append(tx, { type: EVENT_TYPE, payload: { entryId: newId() } });
          throw new Error('a escrita de negócio falhou');
        }),
      ),
    ).rejects.toThrow('a escrita de negócio falhou');

    const restantes = await env.platformPool.query('select id from platform.outbox_events');
    expect(restantes.rowCount).toBe(0);
  });

  it('commit deixa o evento gravado', async () => {
    await append(TENANT_A, { entryId: 'abc' });

    const gravados = await env.platformPool.query('select id from platform.outbox_events');
    expect(gravados.rowCount).toBe(1);
  });

  it('recusa tipo de evento fora da convenção', async () => {
    await expect(
      runInTenantContext({ tenantId: TENANT_A }, () =>
        tenantDb.withTenantTx((tx) => writer.append(tx, { type: 'evento-solto', payload: {} })),
      ),
    ).rejects.toThrow(/fora do formato/);
  });
});

describe('F0-10 entrega após queda', () => {
  it('o worker parado não perde nada: ao subir, publica e o consumidor processa', async () => {
    // worker parado: o evento fica na outbox
    const eventId = await append(TENANT_A, { entryId: 'depois-da-queda' });

    const bus = new InMemoryEventBus();
    const consumer = new SettingsConsumer(tenantDb);
    await bus.subscribe(EVENT_TYPE, (envelope) => consumer.consume(envelope).then(() => undefined));

    // worker sobe
    const publisher = new OutboxPublisher(env.platformPool, bus, logger);
    const resultado = await publisher.publishBatch();

    expect(resultado.published).toBe(1);
    expect(bus.published.map((e) => e.id)).toEqual([eventId]);
    expect(consumer.handled).toHaveLength(1);

    const publicado = await env.platformPool.query<{ published_at: Date | null }>(
      'select published_at from platform.outbox_events where id = $1',
      [eventId],
    );
    expect(publicado.rows[0]?.published_at).not.toBeNull();
  });

  it('o publicador atravessa tenants, que é o que a outbox exige', async () => {
    await append(TENANT_A, { de: 'a' });
    await append(TENANT_B, { de: 'b' });

    const bus = new InMemoryEventBus();
    const resultado = await new OutboxPublisher(env.platformPool, bus, logger).publishBatch();

    expect(resultado.published).toBe(2);
    expect(new Set(bus.published.map((e) => e.tenantId))).toEqual(new Set([TENANT_A, TENANT_B]));
  });

  it('não republica o que já saiu', async () => {
    await append(TENANT_A, { entryId: 'uma-vez' });
    const bus = new InMemoryEventBus();
    const publisher = new OutboxPublisher(env.platformPool, bus, logger);

    await publisher.publishBatch();
    const segunda = await publisher.publishBatch();

    expect(segunda.published).toBe(0);
    expect(bus.published).toHaveLength(1);
  });
});

describe('F0-10 retentativa e dead-letter', () => {
  it('falha agenda nova tentativa com backoff, sem perder o evento', async () => {
    const eventId = await append(TENANT_A, { entryId: 'vai-falhar' });
    const bus = new InMemoryEventBus();
    bus.failNext(1, 'fila fora do ar');

    const resultado = await new OutboxPublisher(env.platformPool, bus, logger).publishBatch();

    expect(resultado).toMatchObject({ published: 0, failed: 1, deadLettered: [] });
    const row = await env.platformPool.query<{
      attempts: number;
      last_error: string;
      published_at: Date | null;
      next_attempt_at: Date;
    }>(
      'select attempts, last_error, published_at, next_attempt_at from platform.outbox_events where id = $1',
      [eventId],
    );
    expect(row.rows[0]).toMatchObject({
      attempts: 1,
      last_error: 'fila fora do ar',
      published_at: null,
    });
    expect(row.rows[0]?.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('vai para dead-letter depois de 10 falhas', async () => {
    const eventId = await append(TENANT_A, { entryId: 'insistente' });
    const bus = new InMemoryEventBus();
    const publisher = new OutboxPublisher(env.platformPool, bus, logger, { maxAttempts: 10 });

    for (let tentativa = 1; tentativa <= 10; tentativa += 1) {
      bus.failNext(1);
      // zera o backoff para o teste não esperar horas
      await env.platformPool.query('update platform.outbox_events set next_attempt_at = now()');
      const resultado = await publisher.publishBatch();
      if (tentativa === 10) {
        expect(resultado.deadLettered).toEqual([eventId]);
      } else {
        expect(resultado.deadLettered).toEqual([]);
      }
    }

    const morto = await env.platformPool.query<{ dead_lettered_at: Date | null }>(
      'select dead_lettered_at from platform.outbox_events where id = $1',
      [eventId],
    );
    expect(morto.rows[0]?.dead_lettered_at).not.toBeNull();

    // e o publicador para de tentar
    await env.platformPool.query('update platform.outbox_events set next_attempt_at = now()');
    expect((await publisher.publishBatch()).failed).toBe(0);
  });

  it('o backoff cresce e tem teto', () => {
    expect(backoffSeconds(1)).toBe(2);
    expect(backoffSeconds(2)).toBe(4);
    expect(backoffSeconds(5)).toBe(32);
    expect(backoffSeconds(30)).toBe(3600);
  });
});

describe('F0-10 idempotência do consumidor', () => {
  it('o mesmo evento entregue duas vezes só tem efeito uma', async () => {
    const eventId = await append(TENANT_A, { entryId: 'repetido' });
    const bus = new InMemoryEventBus();
    await new OutboxPublisher(env.platformPool, bus, logger).publishBatch();
    const envelope = bus.published[0];

    const consumer = new SettingsConsumer(tenantDb);
    const primeira = await consumer.consume(envelope as EventEnvelope);
    const segunda = await consumer.consume(envelope as EventEnvelope);

    expect([primeira, segunda]).toEqual(['processed', 'skipped']);
    expect(consumer.handled).toHaveLength(1);

    const gravados = await withTenantSession(env.ownerPool, TENANT_A, (client) =>
      client.query('select consumer_name from platform.processed_events where event_id = $1', [
        eventId,
      ]),
    );
    expect(gravados.rowCount).toBe(1);
  });

  it('consumidores diferentes processam o mesmo evento', async () => {
    await append(TENANT_A, { entryId: 'dois-ouvintes' });
    const bus = new InMemoryEventBus();
    await new OutboxPublisher(env.platformPool, bus, logger).publishBatch();
    const envelope = bus.published[0] as EventEnvelope;

    const primeiro = new SettingsConsumer(tenantDb);
    const segundo = new (class extends SettingsConsumer {
      override readonly name = 'outro-consumidor';
    })(tenantDb);

    expect(await primeiro.consume(envelope)).toBe('processed');
    expect(await segundo.consume(envelope)).toBe('processed');
  });

  it('se o efeito falha, a marca de processado desfaz junto', async () => {
    await append(TENANT_A, { entryId: 'efeito-falha' });
    const bus = new InMemoryEventBus();
    await new OutboxPublisher(env.platformPool, bus, logger).publishBatch();
    const envelope = bus.published[0] as EventEnvelope;

    class ConsumidorQueFalha extends IdempotentConsumer {
      readonly name = 'consumidor-que-falha';
      readonly eventType = EVENT_TYPE;
      protected handle(): Promise<void> {
        return Promise.reject(new Error('efeito falhou'));
      }
    }

    await expect(new ConsumidorQueFalha(tenantDb).consume(envelope)).rejects.toThrow(
      'efeito falhou',
    );

    const marcas = await withTenantSession(env.ownerPool, TENANT_A, (client) =>
      client.query(
        "select consumer_name from platform.processed_events where consumer_name = 'consumidor-que-falha'",
      ),
    );
    expect(marcas.rowCount).toBe(0);
  });
});

describe('F0-10 consumidor roda no tenant do evento', () => {
  it('o dado gravado fica com o tenant_id do evento', async () => {
    await append(TENANT_B, { entryId: 'do-tenant-b' });
    const bus = new InMemoryEventBus();
    await new OutboxPublisher(env.platformPool, bus, logger).publishBatch();
    const envelope = bus.published[0] as EventEnvelope;

    const consumer = new SettingsConsumer(tenantDb);
    await consumer.consume(envelope);

    const gravado = await withTenantSession(env.ownerPool, TENANT_B, (client) =>
      client.query<{ tenant_id: string }>(
        'select tenant_id from platform.tenant_settings where key = $1',
        [`settings-consumer-${envelope.id}`],
      ),
    );

    expect(gravado.rows[0]?.tenant_id).toBe(TENANT_B);
  });
});
