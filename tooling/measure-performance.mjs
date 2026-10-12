import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:8080';
const region = '20000000-0000-4000-8000-000000000001';
const headers = { 'X-Tandara-Client': 'web', 'Content-Type': 'application/json' };
const login = await fetch(base + '/api/v1/auth/login', {
  method: 'POST',
  headers,
  body: JSON.stringify({ email: 'admin@demo.tandara.test', password: process.env.DEMO_PASSWORD }),
});
if (!login.ok) throw new Error('Performance login failed: ' + login.status);
const cookies = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const endpoints = [
  '/health',
  '/ready',
  '/api/v1/regions/' + region + '/public',
  '/api/v1/regions/' + region + '/reports',
  '/api/v1/regions/' + region + '/coverage',
];
const metrics = [];
for (const path of endpoints) {
  const samples = [];
  for (let batch = 0; batch < 22; batch++)
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        const start = performance.now();
        const r = await fetch(base + path, { headers: { cookie: cookies } });
        await r.arrayBuffer();
        if (!r.ok) throw new Error(path + ' returned ' + r.status);
        if (batch > 1) samples.push(performance.now() - start);
      }),
    );
  samples.sort((a, b) => a - b);
  metrics.push({
    path,
    requests: samples.length,
    concurrency: 5,
    p50Ms: +samples[49].toFixed(2),
    p95Ms: +samples[94].toFixed(2),
    maxMs: +samples.at(-1).toFixed(2),
  });
}
await mkdir('docs/qa', { recursive: true });
const result = {
  measuredAt: new Date().toISOString(),
  environment: 'Local Docker Desktop; synthetic seed; not a capacity claim',
  budget: 'p95 < 500ms on seed dataset',
  metrics,
};
await writeFile('docs/qa/performance.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
