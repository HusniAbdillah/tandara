import { writeFile } from 'node:fs/promises';
const base = process.env.AI_LOAD_URL ?? 'http://127.0.0.1:8081';
const url = new URL(base);
if (
  !['http:', 'https:'].includes(url.protocol) ||
  url.username ||
  url.password ||
  url.pathname !== '/'
)
  throw new Error('Invalid load target.');
if (
  !['127.0.0.1', 'localhost'].includes(url.hostname) &&
  process.env.AI_LOAD_ALLOW_STAGING !== 'true'
)
  throw new Error('Explicit isolated staging authorization required.');
const seconds = Number(process.env.AI_LOAD_SECONDS ?? 900),
  users = Number(process.env.AI_LOAD_USERS ?? 200);
if (
  !Number.isInteger(seconds) ||
  seconds < 1 ||
  seconds > 900 ||
  !Number.isInteger(users) ||
  users < 1 ||
  users > 200 ||
  !process.argv[2]
)
  throw new Error('Provide private output path; duration 1–900 seconds, users 1–200.');
const headers = {
  'content-type': 'application/json',
  'x-tandara-client': 'web',
  cookie: process.env.AI_LOAD_SESSION_COOKIE ?? '',
  'x-csrf-token': process.env.AI_LOAD_CSRF ?? '',
};
const ops = await fetch(base + '/api/v1/admin/ai/operations', { headers }).then(async (r) => {
  if (!r.ok) throw new Error('Authenticated administrator load session required.');
  return r.json();
});
if (!['heuristic', 'disabled'].includes(ops.mode) || ops.embeddingMode !== 'disabled')
  throw new Error(
    'This synthetic load harness forbids billable generation and embeddings. Run approved real-provider capacity evaluation separately.',
  );
const allRegions = await fetch(base + '/api/v1/regions').then((r) => r.json());
const regions = allRegions.filter((r) => r.simulation);
if (!regions.length || regions.length !== allRegions.length)
  throw new Error('Isolated simulation regions required.');
const output = {
  durationSeconds: seconds,
  virtualUsers: users,
  regions: regions.length,
  reports: [],
  queries: [],
  reads: [],
  startedAt: new Date().toISOString(),
  paidInference: false,
};
const pending = new Set();
function issue(group, path, body, extra = {}) {
  const started = performance.now();
  const work = fetch(base + '/api/v1' + path, {
    headers: { ...headers, ...extra },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  })
    .then(async (r) => {
      await r.arrayBuffer();
      output[group].push({ status: r.status, ms: performance.now() - started });
    })
    .catch(() => output[group].push({ status: 0, ms: performance.now() - started }));
  pending.add(work);
  void work.finally(() => pending.delete(work));
}
const ticks = seconds * 2;
for (let tick = 0; tick < ticks; tick++) {
  const start = performance.now(),
    region = regions[tick % regions.length];
  if (pending.size < users) {
    const requestKey = crypto.randomUUID();
    issue(
      'reports',
      '/reports',
      {
        regionId: region.id,
        category: 'road_flooding',
        description:
          'SIMULASI uji kapasitas ' +
          requestKey +
          ': genangan latihan di lokasi yang belum dikonfirmasi.',
        landmarkText: '',
        observationTime: new Date().toISOString(),
        followUpRequested: false,
        contactPermission: false,
        privacyConsent: true,
      },
      { 'idempotency-key': requestKey },
    );
  }
  if (tick % 2 === 0 && ops.mode !== 'disabled')
    issue('queries', '/regions/' + region.id + '/ai/runs', {
      task: 'answer',
      requestKey: crypto.randomUUID(),
      question: 'dokumen',
    });
  if (tick % 40 === 0)
    for (let user = 0; user < users && pending.size < users; user++)
      issue('reads', '/regions/' + regions[user % regions.length].id + '/public');
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, 500 - (performance.now() - start))),
  );
}
await Promise.all(pending);
const summarize = (rows) => {
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    requests: rows.length,
    successes: rows.filter((r) => r.status >= 200 && r.status < 300).length,
    throttled: rows.filter((r) => r.status === 429).length,
    p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] ?? null,
    statusCounts: Object.fromEntries(
      [...new Set(rows.map((r) => r.status))].map((status) => [
        status,
        rows.filter((r) => r.status === status).length,
      ]),
    ),
  };
};
const report = {
  ...output,
  reports: summarize(output.reports),
  queries: summarize(output.queries),
  reads: summarize(output.reads),
  finishedAt: new Date().toISOString(),
  fullDeclaredCapacity: seconds === 900 && users === 200 && regions.length >= 20,
};
await writeFile(process.argv[2], JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
console.info(JSON.stringify(report));
if (
  report.reports.successes !== report.reports.requests ||
  report.queries.successes !== report.queries.requests ||
  report.reads.successes !== report.reads.requests
)
  process.exitCode = 1;
