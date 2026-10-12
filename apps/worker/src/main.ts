import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger, parseEnvironment } from '@tandara/backend';
import { WorkerModule } from './worker.module.js';

try {
  const environment = parseEnvironment(process.env);
  if (environment.WORKER_ENABLED) {
    throw new Error('Consumers are not implemented. Keep WORKER_ENABLED=false until job handlers exist.');
  }
  const app = await NestFactory.createApplicationContext(WorkerModule.register(environment), {
    logger: createLogger(environment, 'worker'),
  });
  app.enableShutdownHooks();
  const keepAlive = setInterval(() => {}, 60000);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => clearInterval(keepAlive));
  }
  console.info('Worker foundation idle; job consumers are not implemented.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Worker startup failed.');
  process.exitCode = 1;
}
