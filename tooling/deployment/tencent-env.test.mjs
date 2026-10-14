import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const template = readFileSync('infrastructure/deployment/tencent.env.example', 'utf8');
const templateKeys = [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);

function resolve(extra = '') {
  const directory = mkdtempSync(join(tmpdir(), 'tandara-env-check-'));
  const file = join(directory, '.env');
  const env = { ...process.env };
  for (const key of [...templateKeys, 'APP_IMAGE', 'POSTGRES_IMAGE']) delete env[key];
  try {
    writeFileSync(
      file,
      template.replace('REPLACE_WITH_RANDOM_HEX', 'ab'.repeat(24)) +
        '\nAPP_IMAGE=tandara-backend:env-check\nPOSTGRES_IMAGE=tandara-postgres:env-check\n' +
        extra,
    );
    return JSON.parse(
      execFileSync(
        'docker',
        [
          'compose',
          '--env-file',
          file,
          '--profile',
          'operations',
          '-f',
          'infrastructure/deployment/backend.compose.yml',
          'config',
          '--format',
          'json',
        ],
        { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('selected Tencent profile enables Vikey/Gemini and forwards every configurable runtime field', () => {
  const config = resolve();
  const api = config.services.api.environment;
  assert.equal(api.AI_MODE, 'compatible');
  assert.equal(api.AI_PROVIDER, 'vikey');
  assert.equal(api.AI_EMBEDDING_MODE, 'compatible');
  assert.equal(api.AI_EMBEDDING_PROVIDER, 'gemini');
  assert.equal(api.AI_DAILY_BUDGET_MICRO_USD, '1000000');
  assert.equal(api.AI_MONTHLY_BUDGET_MICRO_USD, '3000000');
  assert.equal(api.AI_RUN_MAX_MICRO_USD, '1000000');
  assert.equal(api.AI_MAX_OUTPUT_TOKENS, '1024');
  assert.equal(api.APP_MODE, 'simulation');
  assert.equal(api.SESSION_SECURE, 'true');
  const applicationKeys = [
    ...readFileSync('.env.production.example', 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm),
  ].map((m) => m[1]);
  for (const key of applicationKeys.filter((key) => key !== 'DEMO_PASSWORD')) {
    assert.ok(Object.hasOwn(api, key), `${key} must reach the application`);
  }
  assert.deepEqual(config.services.worker.environment, api);
  assert.ok(!Object.hasOwn(api, 'DEMO_PASSWORD'));
});

test('Tencent forwards configured chat, embeddings, MFA and funded budgets to API and worker', () => {
  const config = resolve(
    "AI_MODE=compatible\nAI_MODEL='synthetic-model'\nAI_API_KEY='synthetic-chat-key'\n" +
      "AI_EMBEDDING_MODE=compatible\nAI_EMBEDDING_API_KEY='synthetic-embedding-key'\n" +
      `MFA_ENCRYPTION_KEY=${'cd'.repeat(32)}\nAI_DAILY_BUDGET_MICRO_USD=123456\n`,
  );
  for (const name of ['api', 'worker']) {
    const env = config.services[name].environment;
    assert.equal(env.AI_MODE, 'compatible');
    assert.equal(env.AI_MODEL, 'synthetic-model');
    assert.equal(env.AI_API_KEY, 'synthetic-chat-key');
    assert.equal(env.AI_EMBEDDING_MODE, 'compatible');
    assert.equal(env.AI_EMBEDDING_API_KEY, 'synthetic-embedding-key');
    assert.equal(env.MFA_ENCRYPTION_KEY, 'cd'.repeat(32));
    assert.equal(env.AI_DAILY_BUDGET_MICRO_USD, '123456');
  }
});

test('single-quoted passphrase survives both Bash sourcing and Compose interpolation literally', () => {
  const password = 'Synthetic sentence $literal # marker ! 2026';
  const config = resolve(`DEMO_PASSWORD='${password}'\n`);
  // `compose config` escapes dollars for serialization into reusable Compose YAML/JSON.
  assert.equal(
    config.services.seed.environment.DEMO_PASSWORD,
    password.replaceAll('$', () => '$$'),
  );
  const value = execFileSync('bash', ['-s'], {
    input: `set -eu\nDEMO_PASSWORD='${password}'\nprintf '%s' "$DEMO_PASSWORD"\n`,
    encoding: 'utf8',
  });
  assert.equal(value, password);
});
