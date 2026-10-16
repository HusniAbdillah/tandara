import 'reflect-metadata';
import { JobsService, parseEnvironment, startTelemetry } from '@tandara/backend';
import { createApp } from './bootstrap.js';

try {
  const environment = parseEnvironment(process.env);
  startTelemetry('tandara-api');
  const app = await createApp(environment);
  await app.listen(environment.API_PORT, environment.API_HOST);
  if (environment.WORKER_ENABLED && environment.NODE_ENV !== 'test') {
    const jobs = app.get(JobsService);
    let busy = false;
    let lastSchedule = 0;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        if (Date.now() - lastSchedule > 60000) {
          await jobs.schedule();
          lastSchedule = Date.now();
        }
        while (await jobs.tick()) {
          // Drain ready jobs promptly in local/dev runtime
        }
      } catch {
        // Worker errors are recorded on outbox_jobs/ai_runs
      } finally {
        busy = false;
      }
    }, 1000);
    timer.unref();
  }
} catch {
  console.error('API startup failed. Check environment configuration and service availability.');
  process.exitCode = 1;
}
