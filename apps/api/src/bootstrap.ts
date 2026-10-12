import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createLogger } from '@tandara/backend';
import type { Environment } from '@tandara/backend';
import { AppModule } from './app.module.js';
import { ApiErrorFilter } from './http/api-error.filter.js';

export function createHttpAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: 1024 * 1024,
    genReqId: () => randomUUID(),
    // Do not trust arbitrary forwarded headers unless the deployment proxy is explicitly configured.
    trustProxy: false,
  });
}

export async function configureHttp(app: NestFastifyApplication): Promise<void> {
  await app.register(helmet);
  await app.register(cookie);
  app.useGlobalFilters(new ApiErrorFilter());
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      reply.header('X-Request-Id', request.id);
      reply.header('Cache-Control', 'no-store');
    });
  app.enableShutdownHooks();
}

export async function createApp(environment: Environment): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(environment),
    createHttpAdapter(),
    { logger: createLogger(environment, 'api') },
  );
  await configureHttp(app);
  return app;
}
