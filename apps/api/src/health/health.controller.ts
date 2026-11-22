import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@watchlist/shared';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Utilisé par le reverse proxy, le healthcheck Docker et la supervision :
   * renvoie 503 quand la base ne répond pas, pour que la panne soit visible.
   */
  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      const body: HealthResponse = { status: 'error', db: 'down' };
      throw new ServiceUnavailableException(body);
    }
  }
}
