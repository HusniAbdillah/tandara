import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Test } from '@nestjs/testing';
import { DatabaseService, parseEnvironment } from '@tandara/backend';
import { AppModule } from '../dist/app.module.js';
import { configureHttp, createHttpAdapter } from '../dist/bootstrap.js';
import { ServiceUnavailableException } from '@nestjs/common';
import { ApiErrorFilter } from '../dist/http/api-error.filter.js';

let app;
let databaseReady = true;
test('AI budget rejection has an actionable code without exposing arbitrary service details', () => {
  for (const [exception, code] of [
    [
      new ServiceUnavailableException({ code: 'AI_BUDGET_EXCEEDED', message: 'private details' }),
      'AI_BUDGET_EXCEEDED',
    ],
    [new ServiceUnavailableException('private provider details'), 'SERVICE_UNAVAILABLE'],
  ]) {
    let body;
    const reply = {
      status: () => reply,
      send: (value) => {
        body = value;
      },
    };
    new ApiErrorFilter().catch(exception, {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'test-request' }),
        getResponse: () => reply,
      }),
    });
    assert.equal(body.error.code, code);
    assert.equal(body.error.requestId, 'test-request');
    assert.ok(!body.error.message.includes('private'));
  }
});
before(async () => {
  const environment = parseEnvironment({
    DATABASE_URL: 'postgres://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
  });
  const module = await Test.createTestingModule({ imports: [AppModule.register(environment)] })
    .overrideProvider(DatabaseService)
    .useValue({ isReady: async () => databaseReady })
    .compile();
  app = module.createNestApplication(createHttpAdapter(), { logger: false });
  await configureHttp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
after(async () => {
  await app?.close();
});

test('health is independent of database readiness and includes security headers', async () => {
  databaseReady = false;
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'ok');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['x-request-id']);
});

test('readiness fails closed when database is unavailable', async () => {
  databaseReady = false;
  const response = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(response.json().error.requestId, response.headers['x-request-id']);
});

test('readiness succeeds when database is available', async () => {
  databaseReady = true;
  const response = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(response.statusCode, 200);
});

test('anonymous reports require login before database access or payload validation', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { 'x-tandara-client': 'web' },
    payload: {},
  });
  assert.equal(response.statusCode, 401);
});

test('published OpenAPI describes the implemented metadata contract', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/system/openapi.json' });
  assert.equal(response.statusCode, 200);
  assert.ok(response.json().paths['/api/v1/system/info']);
  assert.ok(response.json().paths['/api/v1/reports'].post.requestBody);
});
