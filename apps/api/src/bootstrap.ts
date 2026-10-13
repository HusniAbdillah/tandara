import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createLogger } from '@tandara/backend';
import type { Environment } from '@tandara/backend';
import { AppModule } from './app.module.js';
import { ApiErrorFilter } from './http/api-error.filter.js';

// Use this API's package graph for DI tokens, including pnpm injected workspaces.
export { JobsService, AiService, KnowledgeService, DatabaseService } from '@tandara/backend';

export function createHttpAdapter(level = 'info'): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: 3 * 1024 * 1024,
    logger: {
      level,
      serializers: {
        req: (request: { method: string; url: string }) => ({
          method: request.method,
          url: request.url.split('?')[0] ?? '/',
        }),
      },
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-tracking-token"]',
        'req.headers["x-csrf-token"]',
        'req.body',
        'res.headers["set-cookie"]',
      ],
    },
    genReqId: () => randomUUID(),
    // Do not trust arbitrary forwarded headers unless the deployment proxy is explicitly configured.
    trustProxy: process.env['TRUST_PROXY'] === 'true',
  });
}

export async function configureHttp(app: NestFastifyApplication): Promise<void> {
  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    allowList: (request) => ['/health', '/ready'].includes(request.url),
  });
  app.useGlobalFilters(new ApiErrorFilter());
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      reply.header('X-Request-Id', request.id);
      reply.header('Cache-Control', 'no-store');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const allowed = (
          process.env['WEB_ORIGINS'] ??
          'http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081'
        ).split(',');
        if (
          request.headers['x-tandara-client'] !== 'web' ||
          (request.headers.origin && !allowed.includes(request.headers.origin))
        )
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Origin atau header permintaan tidak diizinkan.',
              requestId: request.id,
            },
          });
      }
    });
  app.enableShutdownHooks();
}

export async function createApp(environment: Environment): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(environment),
    createHttpAdapter(environment.LOG_LEVEL),
    { logger: createLogger(environment, 'api') },
  );
  await configureHttp(app);
  return app;
}
