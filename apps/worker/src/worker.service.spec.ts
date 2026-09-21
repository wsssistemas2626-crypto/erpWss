import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

describe('F0-01 WorkerService', () => {
  it('sobe ocioso e sem jobs registrados', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    const worker = moduleRef.get(WorkerService);

    expect(worker.status('outbox')).toEqual({ name: 'outbox', state: 'idle' });
    expect(worker.registeredJobs()).toEqual([]);
  });
});
