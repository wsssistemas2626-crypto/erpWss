import type { EventBus, EventEnvelope, EventHandler } from '../event';

/**
 * Bus em memória para testes: entrega síncrona, sem fila e sem Docker extra.
 * Permite programar falhas, para exercitar backoff e dead-letter do publicador.
 */
export class InMemoryEventBus implements EventBus {
  readonly published: EventEnvelope[] = [];
  private readonly handlers = new Map<string, EventHandler[]>();
  private failuresLeft = 0;
  private failureMessage = 'falha simulada na publicação';

  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  /** Faz as próximas `times` publicações falharem. */
  failNext(times: number, message?: string): void {
    this.failuresLeft = times;
    if (message !== undefined) {
      this.failureMessage = message;
    }
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error(this.failureMessage);
    }

    this.published.push(envelope);
    for (const handler of this.handlers.get(envelope.type) ?? []) {
      await handler(envelope);
    }
  }

  subscribe(type: string, handler: EventHandler): Promise<void> {
    const existing = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...existing, handler]);
    return Promise.resolve();
  }
}
