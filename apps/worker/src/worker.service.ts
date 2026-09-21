import type { Logger } from '@erp/platform-observability';
import { OutboxPublisher, type EventBus } from '@erp/platform-outbox';
import { Injectable } from '@nestjs/common';

export interface WorkerStatus {
  readonly name: string;
  readonly state: 'idle' | 'running' | 'stopped';
  readonly consumers: readonly string[];
}

/**
 * Processos em background (ADR-003).
 *
 * Hoje roda só o publicador da outbox. Os consumidores dos módulos são registrados aqui a
 * partir da Fase 1, cada um numa fila do seu tipo de evento.
 */
@Injectable()
export class WorkerService {
  private state: WorkerStatus['state'] = 'idle';
  private readonly consumers: string[] = [];

  constructor(
    private readonly bus: EventBus,
    private readonly publisher: OutboxPublisher,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    await this.bus.start();
    this.publisher.start();
    this.state = 'running';
    this.logger.info({ consumers: this.consumers }, 'publicador da outbox no ar');
  }

  async stop(): Promise<void> {
    await this.publisher.stop();
    await this.bus.stop();
    this.state = 'stopped';
    this.logger.info('worker encerrado');
  }

  status(name: string): WorkerStatus {
    return { name, state: this.state, consumers: [...this.consumers] };
  }

  registeredJobs(): readonly string[] {
    return [...this.consumers];
  }
}
