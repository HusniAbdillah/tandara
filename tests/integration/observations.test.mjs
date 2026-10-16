import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../../apps/api/dist/bootstrap.js';
import { parseEnvironment } from '../../packages/backend/dist/index.js';

test('public observation HTTP endpoint normalizes both live adapters and caches across requests', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let app;
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url === 'https://poskobanjir.dsdadki.web.id/')
      return new Response(
        `<html><table><tr onclick="ShowPopup('Pintu Uji','-250','2000','1500','800','-6.2,106.8,Pintu Uji,-250,Status : Normal,116','Proses Pemetaan')"><td>1</td><td>Pintu Uji</td><td>Ciliwung</td><td>-25</td><td></td><td>16/10/2026</td><td>13:30</td><td><img src="images/icon/icon-normal.png"></td></tr></table></html>`,
      );
    if (url === 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json')
      return new Response(
        JSON.stringify({
          Infogempa: {
            gempa: [
              {
                DateTime: '2026-10-16T10:21:55+07:00',
                Coordinates: '-6.69,106.63',
                Magnitude: '2.5',
                Kedalaman: '9 km',
                Wilayah: 'Bogor',
                Dirasakan: 'II Kabandungan',
              },
            ],
          },
        }),
      );
    throw new Error('Unexpected upstream');
  };
  try {
    app = await createApp(
      parseEnvironment({
        ...process.env,
        NODE_ENV: 'test',
        APP_MODE: 'simulation',
        OBSERVATIONS_MODE: 'live',
        AI_MODE: 'disabled',
        AI_EMBEDDING_MODE: 'disabled',
        LOG_LEVEL: 'silent',
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const get = (path) => app.inject({ method: 'GET', url: '/api/v1' + path });
    const path = '/regions/20000000-0000-4000-8000-000000000001/observations';
    const response = await get(path);
    assert.equal(response.statusCode, 200, response.body);
    const feed = response.json();
    assert.equal(feed.mode, 'live');
    assert.equal(feed.water[0].heightCm, -25);
    assert.equal(feed.water[0].id, 'dsda-116');
    assert.equal(feed.water[0].updatedAt, '2026-10-16T06:30:00.000Z');
    assert.equal(feed.water[0].thresholds.length, 4);
    assert.equal(feed.earthquakes[0].occurredAt, '2026-10-16T03:21:55.000Z');
    assert.equal(feed.earthquakes[0].location.latitude, -6.69);
    assert.deepEqual(
      feed.sources.map((source) => source.status),
      ['ready', 'ready'],
    );
    await get(path);
    assert.equal(requests.length, 2);
    const missing = await get('/regions/99999999-9999-4999-8999-999999999999/observations');
    assert.equal(missing.json().mode, 'unconfigured');
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await app?.close();
  }
});
