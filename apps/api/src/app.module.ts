import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule, DatabaseModule } from '@tandara/backend';
import type { Environment } from '@tandara/backend';
import { HealthController } from './http/health.controller.js';
import { SystemController } from './http/system.controller.js';

@Module({})
export class AppModule {
  static register(environment: Environment): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(environment), DatabaseModule],
      controllers: [HealthController, SystemController],
    };
  }
}
