import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  async function setup(queryRaw: () => Promise<unknown>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('signale la base comme disponible', async () => {
    const controller = await setup(() => Promise.resolve([{ '?column?': 1 }]));
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('signale la base comme indisponible sans planter', async () => {
    const controller = await setup(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    );
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'down',
    });
  });
});
