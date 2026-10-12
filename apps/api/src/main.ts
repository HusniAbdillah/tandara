import 'reflect-metadata';
import { parseEnvironment } from '@tandara/backend';
import { createApp } from './bootstrap.js';

try {
  const environment = parseEnvironment(process.env);
  const app = await createApp(environment);
  await app.listen(environment.API_PORT, environment.API_HOST);
} catch {
  console.error('API startup failed. Check environment configuration and service availability.');
  process.exitCode = 1;
}
