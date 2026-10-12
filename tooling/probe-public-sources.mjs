import { mkdir, writeFile } from 'node:fs/promises';
import { BmkgSource, PetaBencanaSource } from '../packages/backend/dist/modules/adapters.js';
const results = [];
// Read-only, one request per documented public endpoint. Does not enable/store live data.
for (const [provider, adapter, config] of [
  ['bmkg', new BmkgSource(), { adm4: '31.71.03.1001' }],
  ['petabencana', new PetaBencanaSource(), { admin: 'ID-JK' }],
]) {
  try {
    const items = await adapter.ingest({
      id: crypto.randomUUID(),
      regionId: crypto.randomUUID(),
      name: provider,
      provider,
      mode: 'live',
      sourceUrl:
        provider === 'bmkg' ? 'https://data.bmkg.go.id/prakiraan-cuaca/' : 'https://petabencana.id',
      config,
    });
    results.push({
      provider,
      result: 'normalized',
      count: items.length,
      sourceType: items[0]?.sourceType ?? null,
    });
  } catch {
    results.push({ provider, result: 'unavailable', count: 0 });
  }
}
const evidence = {
  checkedAt: new Date().toISOString(),
  scope:
    'Read-only public probe; no live activation or persistence; empty feed does not validate all non-empty payload variants',
  results,
};
await mkdir('docs/qa', { recursive: true });
await writeFile('docs/qa/public-source-probe.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
