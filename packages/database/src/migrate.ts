import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { createDatabase } from './client.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required. Copy .env.example to .env.');

const { db } = createDatabase(connectionString);
try {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      import: (filePath) => import(pathToFileURL(filePath).href),
      migrationFolder: fileURLToPath(new URL('./migrations/', import.meta.url)),
    }),
  });
  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    console.info(`${result.migrationName}: ${result.status}`);
  }
  if (error) throw error;
} finally {
  await db.destroy();
}
