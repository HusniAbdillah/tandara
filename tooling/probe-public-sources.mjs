// Read-only public-source probe. Never loads .env, calls AI, or writes the database.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { BmkgSource, PetaBencanaSource } from '../packages/backend/dist/modules/adapters.js';
import { BmkgNowcastSource } from '../packages/backend/dist/modules/bmkg-nowcast.js';

const base = {
  id: randomUUID(),
  regionId: randomUUID(),
  name: 'Public-source audit',
  mode: 'live',
  sourceUrl: 'https://data.bmkg.go.id/',
  config: { authorized: true },
};
const targets = [
  ['bmkg', new BmkgSource(), { adm4: '31.75.03.1002' }],
  ['bmkg_nowcast', new BmkgNowcastSource(), { province: 'DKI Jakarta' }],
  ['petabencana', new PetaBencanaSource(), { admin: 'ID-JK' }],
];
const evidence = {
  capturedAt: new Date().toISOString(),
  purpose: 'Public-source evidence only; not a deployed feed or verified evacuation plan.',
  sources: [],
};
for (const [provider, adapter, config] of targets) {
  try {
    const records = await adapter.ingest({ ...base, provider, config });
    const hash = createHash('sha256').update(JSON.stringify(records)).digest('hex');
    evidence.sources.push({
      provider,
      config,
      ok: true,
      count: records.length,
      sha256: hash,
      records,
    });
    console.log(
      provider +
        ': ' +
        records.length +
        ' source records; geographic matching is performed by the worker, not this probe.',
    );
  } catch (error) {
    evidence.sources.push({
      provider,
      config,
      ok: false,
      error: error instanceof Error ? error.message : 'Source unavailable',
    });
    console.error(provider + ': probe failed');
    process.exitCode = 1;
  }
}
await mkdir('.local', { recursive: true });
const capturePath =
  '.local/public-source-evidence-' + evidence.capturedAt.replace(/[:.]/g, '-') + '.json';
await writeFile(capturePath, JSON.stringify(evidence, null, 2) + '\n');
await writeFile('.local/public-source-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(
  'Evidence: .local/public-source-evidence.json (private local artifact; do not relabel as current data).',
);
