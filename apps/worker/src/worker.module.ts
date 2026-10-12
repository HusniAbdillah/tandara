import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@tandara/backend';
import type { Environment } from '@tandara/backend';

@Module({})
export class WorkerModule {
  static register(environment: Environment): DynamicModule {
    return { module: WorkerModule, imports: [ConfigModule.forRoot(environment)] };
  }
}
