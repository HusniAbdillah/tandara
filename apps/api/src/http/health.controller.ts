import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '@tandara/backend';
import { healthResponseSchema } from '@tandara/contracts';

@Controller()
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get('/health')
  health() {
    return healthResponseSchema.parse({ status: 'ok', service: 'tandara-api' });
  }

  @Get('/ready')
  async ready() {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException('Database unavailable.');
    }
    // Redis is not required for basic API readiness. Background processing has its own health.
    return { status: 'ready', dependencies: { database: 'ok' } };
  }
}
