import type { EntityId } from '@erp/shared-kernel';

/**
 * Envelope de um evento de domínio (ADR-003).
 *
 * O payload leva IDs e o mínimo necessário, nunca a entidade inteira: o consumidor busca
 * o resto se precisar, e assim uma mudança de schema do emissor não quebra quem ouve.
 * O schema zod de cada payload mora na lib `-api` do módulo emissor.
 */
export interface EventEnvelope {
  readonly id: EntityId;
  readonly tenantId: EntityId;
  /** `<modulo>.<entidade>.<fato-no-passado>.v<N>`, ex.: `projects.timesheet-entry.approved.v1`. */
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

/** `<modulo>.<entidade>.<fato>.v<N>` */
export const EVENT_TYPE = /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+\.v\d+$/;

export type EventHandler = (envelope: EventEnvelope) => Promise<void>;

/**
 * Transporte dos eventos já confirmados. O outbox garante que o evento existe; o bus só
 * cuida da entrega. Ter interface aqui é o que permite testar publicador e consumidores
 * sem subir fila nenhuma.
 */
export interface EventBus {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(envelope: EventEnvelope): Promise<void>;
  subscribe(type: string, handler: EventHandler): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
