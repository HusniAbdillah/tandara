import { mkdir, writeFile } from 'node:fs/promises';
import { buildOpenApiDocument } from './http/openapi.js';

const directory = new URL('../../../docs/api/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('openapi.json', directory), `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
