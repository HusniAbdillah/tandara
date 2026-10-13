import 'reflect-metadata';
import { parseEnvironment, startTelemetry } from '@tandara/backend';
import { createApp } from './bootstrap.js';

try {
  const environment = parseEnvironment(process.env);
  startTelemetry('tandara-api');
  const app = await createApp(environment);
  await app.listen(environment.API_PORT, environment.API_HOST);
} catch {
  console.error('API startup failed. Check environment configuration and service availability.');
  process.exitCode = 1;
}
