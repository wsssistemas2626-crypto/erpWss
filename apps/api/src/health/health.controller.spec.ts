import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { HealthController } from './health.controller';

describe('F0-01 HealthController', () => {
  it('responde que a api está saudável', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const controller = moduleRef.get(HealthController);

    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
