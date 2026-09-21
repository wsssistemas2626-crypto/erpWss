import { Injectable } from '@nestjs/common';

export interface WorkerStatus {
  readonly name: string;
  readonly state: 'idle';
}

/**
 * Ponto de entrada dos processos em background. Os consumidores de fila (pg-boss)
 * são registrados aqui a partir do item F0-10.
 */
@Injectable()
export class WorkerService {
  private readonly jobs: string[] = [];

  status(name: string): WorkerStatus {
    return { name, state: 'idle' };
  }

  registeredJobs(): readonly string[] {
    return this.jobs;
  }
}
