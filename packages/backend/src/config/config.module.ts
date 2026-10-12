import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ENVIRONMENT } from './environment.js';
import type { Environment } from './environment.js';

@Global()
@Module({})
export class ConfigModule {
  static forRoot(environment: Environment): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: ENVIRONMENT, useValue: Object.freeze(environment) }],
      exports: [ENVIRONMENT],
    };
  }
}
