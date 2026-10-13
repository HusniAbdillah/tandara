import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const digest = (x) =>
  createHash('sha256')
    .update(typeof x === 'string' ? x : JSON.stringify(x))
    .digest('hex');
test('paid evaluation and restore replay fail closed before contacting external services', () => {
  const env = {
    ...process.env,
    AI_EVALUATION_ALLOW_PAID: 'false',
    AI_EVALUATION_APPROVED_DATA: 'false',
    RESTORE_QUARANTINE: 'false',
    APP_MODE: 'simulation',
  };
  for (const [file, pattern] of [
    ['run-ai-evaluation.mjs', /explicit paid-call/],
    ['restore-privacy.mjs', /isolated, non-serving/],
    ['privacy-ledger-backup.mjs', /Privacy ledger backup failed/],
    ['onboard-production.mjs', /isolated production mode/],
    ['provision-production-user.mjs', /isolated production maintenance/],
  ]) {
    const result = spawnSync(process.execPath, ['tooling/' + file], { env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, pattern);
  }
});
test('protected evaluation rejects external content tracing before input or provider access', () => {
  const result = spawnSync(process.execPath, ['tooling/run-ai-evaluation.mjs'], {
    env: {
      ...process.env,
      LANGSMITH_TRACING: 'true',
      AI_EVALUATION_ALLOW_PAID: 'true',
      AI_EVALUATION_APPROVED_DATA: 'true',
    },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /External model content tracing is prohibited/);
});

test('quality scoring rejects small datasets and missing independent evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tandara-ai-tools-'));
  const paths = ['dataset.jsonl', 'artifact.json', 'reviews.json', 'report.json'].map((f) =>
    join(dir, f),
  );
  const dataset =
    JSON.stringify({
      id: 'fixture-1',
      task: 'answer',
      adversarial: true,
      expectedAbstention: true,
    }) + '\n';
  const output = { abstained: true };
  const artifact = {
    datasetHash: digest(dataset),
    modelFingerprints: { assistance: 'a'.repeat(64) },
    completedAt: new Date().toISOString(),
    results: [{ caseId: 'fixture-1', output, outputHash: digest(output), durationMs: 1 }],
  };
  const reviews = {
    cases: [
      {
        caseId: 'fixture-1',
        outputHash: digest(output),
        reviewedBy: ['fixture-reviewer'],
        claimCount: 0,
        supportedClaimCount: 0,
        unsupportedCriticalClaims: 0,
        crossRegionLeaks: 0,
        unauthorizedMutations: 0,
        abstentionCorrect: true,
      },
    ],
  };
  try {
    writeFileSync(paths[0], dataset);
    writeFileSync(paths[1], JSON.stringify(artifact));
    writeFileSync(paths[2], JSON.stringify(reviews));
    const result = spawnSync(process.execPath, ['tooling/score-ai-evaluation.mjs', ...paths], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(readFileSync(paths[3], 'utf8'));
    assert.equal(report.passed, false);
    assert.equal(report.caseCount, 1);
    assert.equal(report.independentSecurityReviewHash, null);
    writeFileSync(paths[0], dataset.replace('fixture-1', 'fixture-2'));
    const changed = spawnSync(process.execPath, ['tooling/score-ai-evaluation.mjs', ...paths], {
      encoding: 'utf8',
    });
    assert.notEqual(changed.status, 0);
    assert.match(changed.stderr, /does not match frozen artifact/);
  } finally {
    for (const path of paths) {
      try {
        unlinkSync(path);
      } catch {
        /* A failed stage may not create this output. */
      }
    }
    rmdirSync(dir);
  }
});
