import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const apps = new Set(['resident-web', 'coordinator-web']);
export function outputConfig(app, apiOrigin) {
  if (!apps.has(app)) throw new Error('Unknown frontend');
  const url = new URL(apiOrigin);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('API origin must be a plain HTTPS origin');
  const posko = app === 'coordinator-web';
  const tiles = ' https://tile.openstreetmap.org';
  return {
    version: 3,
    routes: [
      {
        src: '/.*',
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
          'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:${tiles}; connect-src 'self'${tiles}; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
        },
        continue: true,
      },
      {
        src: '^/api(/.*)?$',
        dest: `${url.origin}/api$1`,
        headers: { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' },
      },
      {
        src: '^/(health|ready)$',
        dest: `${url.origin}/$1`,
        headers: { 'Cache-Control': 'no-store' },
      },
      {
        src: '^/assets/.*$',
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        continue: true,
      },
      {
        src: '^/(sw\\.js|manifest\\.webmanifest|workbox-.*\\.js|basemap\\.json)$',
        headers: { 'Cache-Control': 'no-cache' },
        continue: true,
      },
      { handle: 'filesystem' },
      { src: '^/.*\\.[^/]+$', status: 404 },
      {
        src: '/.*',
        dest: '/index.html',
        headers: { 'Cache-Control': posko ? 'no-store' : 'no-cache' },
      },
    ],
  };
}

export async function prepare(app, apiOrigin, orgId, projectId) {
  if (!orgId || !projectId || !/^[\w-]+$/.test(orgId) || !/^[\w-]+$/.test(projectId))
    throw new Error('Set valid VERCEL_ORG_ID and VERCEL_PROJECT_ID');
  const config = outputConfig(app, apiOrigin);
  const root = process.cwd();
  const destination = path.join(root, '.local', 'deploy', app);
  // Refuse reuse rather than accidentally upload stale assets from a previous build.
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination);
  const dist = path.join(root, 'apps', app, 'dist');
  await readFile(path.join(dist, 'index.html'));
  const vercel = path.join(destination, '.vercel');
  await mkdir(path.join(vercel, 'output'), { recursive: true });
  await cp(dist, path.join(vercel, 'output', 'static'), { recursive: true });
  await writeFile(
    path.join(vercel, 'output', 'config.json'),
    JSON.stringify(config, null, 2) + '\n',
  );
  await writeFile(
    path.join(vercel, 'project.json'),
    JSON.stringify({ orgId, projectId }, null, 2) + '\n',
  );
  return destination;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const destination = await prepare(
      process.argv[2],
      process.env.TANDARA_API_ORIGIN ?? 'https://api.tandara.my.id',
      process.env.VERCEL_ORG_ID,
      process.env.VERCEL_PROJECT_ID,
    );
    console.info(destination);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Frontend packaging failed');
    process.exitCode = 1;
  }
}
