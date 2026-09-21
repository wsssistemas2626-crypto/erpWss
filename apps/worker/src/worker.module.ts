import type { WorkerEnv } from '@erp/platform-config';
import type { Logger } from '@erp/platform-observability';
import type { EventBus, OutboxPublisher } from '@erp/platform-outbox';
import { Module, type DynamicModule } from '@nestjs/common';
import { WORKER_ENV } from './tokens';
import { WorkerService } from './worker.service';

export interface WorkerDependencies {
  readonly env: WorkerEnv;
  readonly logger: Logger;
  readonly bus: EventBus;
  readonly publisher: OutboxPublisher;
}

/** Composição do worker. Como na API, tudo entra por parâmetro para o teste poder trocar. */
@Module({})
export class WorkerModule {
  static forRoot(dependencies: WorkerDependencies): DynamicModule {
    return {
      module: WorkerModule,
      providers: [
        { provide: WORKER_ENV, useValue: dependencies.env },
        {
          provide: WorkerService,
          useFactory: (): WorkerService =>
            new WorkerService(dependencies.bus, dependencies.publisher, dependencies.logger),
        },
      ],
      exports: [WorkerService, WORKER_ENV],
    };
  }
}
