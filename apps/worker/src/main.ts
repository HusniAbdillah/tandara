import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  createLogger,
  parseEnvironment,
  JobsService,
  startTelemetry,
  stopTelemetry,
} from '@tandara/backend';
import { WorkerModule } from './worker.module.js';

try {
  const environment = parseEnvironment(process.env);
  startTelemetry('tandara-worker');
  const app = await NestFactory.createApplicationContext(WorkerModule.register(environment), {
    logger: createLogger(environment, 'worker'),
  });
  app.enableShutdownHooks();
  const jobs = app.get(JobsService);
  let stopping = false;
  let lastSchedule = 0;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      stopping = true;
    });
  }
  console.info(JSON.stringify({ event: 'worker_started', enabled: environment.WORKER_ENABLED }));
  while (!stopping) {
    if (environment.WORKER_ENABLED) {
      try {
        if (Date.now() - lastSchedule > 60000) {
          await jobs.schedule();
          lastSchedule = Date.now();
        }
        if (await jobs.tick()) continue;
      } catch {
        console.error(JSON.stringify({ event: 'worker_iteration_failed' }));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await app.close();
  await stopTelemetry();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Worker startup failed.');
  process.exitCode = 1;
}
