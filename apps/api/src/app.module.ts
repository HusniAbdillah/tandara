import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule, DatabaseModule, ProductModule } from '@tandara/backend';
import type { Environment } from '@tandara/backend';
import { HealthController } from './http/health.controller.js';
import { SystemController } from './http/system.controller.js';
import { ProductController } from './http/product.controller.js';

@Module({})
export class AppModule {
  static register(environment: Environment): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(environment), DatabaseModule, ProductModule],
      controllers: [HealthController, SystemController, ProductController],
    };
  }
}
