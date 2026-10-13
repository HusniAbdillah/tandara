import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outputConfig } from './prepare-vercel.mjs';

test('authenticated/private API routes bypass filesystem and SPA and stay uncacheable', () => {
  const { routes } = outputConfig('coordinator-web', 'https://api.tandora.my.id');
  const apiIndex = routes.findIndex((r) => r.dest?.startsWith('https://api.tandora.my.id/api'));
  assert.ok(apiIndex < routes.findIndex((r) => r.handle === 'filesystem'));
  const route = routes[apiIndex];
  for (const url of ['/api/v1/auth/login', '/api/v1/reports/123/attachments/456', '/api']) {
    assert.match(url, new RegExp(route.src));
    assert.equal(url.replace(new RegExp(route.src), route.dest), 'https://api.tandora.my.id' + url);
  }
  assert.equal(route.headers['Cache-Control'], 'no-store');
  assert.equal(route.headers['Vercel-CDN-Cache-Control'], 'no-store');
});

test('real assets use filesystem, missing assets return 404 rather than a cached HTML shell', () => {
  const { routes } = outputConfig('resident-web', 'https://api.tandora.my.id');
  const filesystem = routes.findIndex((r) => r.handle === 'filesystem');
  const missingAsset = routes.findIndex((r) => r.status === 404);
  assert.ok(filesystem < missingAsset);
  assert.match('/missing.js', new RegExp(routes[missingAsset].src));
  assert.doesNotMatch('/rencana', new RegExp(routes[missingAsset].src));
  assert.equal(routes.at(-1).dest, '/index.html');
  const mutable = routes.find((r) => r.headers?.['Cache-Control'] === 'no-cache' && r.continue);
  for (const url of ['/sw.js', '/manifest.webmanifest', '/basemap.json'])
    assert.match(url, new RegExp(mutable.src));
});

test('only Posko allows map tiles and HTTPS origins cannot include credentials or paths', () => {
  const warga = outputConfig('resident-web', 'https://api.tandora.my.id');
  const posko = outputConfig('coordinator-web', 'https://api.tandora.my.id');
  assert.doesNotMatch(warga.routes[0].headers['Content-Security-Policy'], /openstreetmap/);
  assert.match(
    posko.routes[0].headers['Content-Security-Policy'],
    /https:\/\/tile.openstreetmap.org/,
  );
  assert.equal(posko.routes[0].headers['Referrer-Policy'], 'strict-origin');
  for (const origin of [
    'http://api.tandora.my.id',
    'https://user:password@api.tandora.my.id',
    'https://api.tandora.my.id/api',
    'https://api.tandora.my.id?secret=1',
  ])
    assert.throws(() => outputConfig('resident-web', origin));
});
