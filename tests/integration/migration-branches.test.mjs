import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { createDatabase } from '../../packages/database/dist/client.js';
const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const { Migrator } = require('kysely/migration');

test('fresh and either shipped 011 migration upgrade without renaming applied history', async () => {
  assert.equal(process.env.APP_MODE, 'simulation');
  const source = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(source.hostname));
  const owner = new Client({ connectionString: source.href });
  await owner.connect();
  const directory = new URL('../../packages/database/dist/migrations/', import.meta.url);
  const migrations = Object.fromEntries(
    await Promise.all(
      readdirSync(directory)
        .filter((file) => /^\d+_.*\.js$/.test(file))
        .map(async (file) => [file.slice(0, -3), await import(new URL(file, directory).href)]),
    ),
  );
  try {
    for (const previous of [null, '011_report_workflow', '011_resident_integration']) {
      const name = 'migration_branch_' + crypto.randomUUID().replaceAll('-', '');
      assert.match(name, /^migration_branch_[a-f0-9]{32}$/);
      await owner.query('CREATE DATABASE ' + name);
      const connection = new URL(source);
      connection.pathname = '/' + name;
      const { db } = createDatabase(connection.href);
      const migrate = async (available, unordered = false) => {
        const result = await new Migrator({
          db,
          allowUnorderedMigrations: unordered,
          provider: { getMigrations: async () => available },
        }).migrateToLatest();
        assert.ifError(result.error);
      };
      try {
        if (previous)
          await migrate(
            Object.fromEntries(
              Object.entries(migrations).filter(([key]) => key < '011' || key === previous),
            ),
          );
        await migrate(migrations, true);
        await migrate(migrations, true);
        const client = new Client({ connectionString: connection.href });
        await client.connect();
        try {
          const applied = (await client.query('SELECT name FROM kysely_migration')).rows.map(
            (r) => r.name,
          );
          assert.ok(applied.includes('011_report_workflow'));
          assert.ok(applied.includes('011_resident_integration'));
          assert.ok(applied.includes('012_resident_workflow_notifications'));
          assert.equal(applied.length, Object.keys(migrations).length);
          const columns = (
            await client.query(
              "SELECT column_name FROM information_schema.columns WHERE table_name='reports'",
            )
          ).rows.map((r) => r.column_name);
          assert.ok(columns.includes('resident_id'));
          assert.ok(columns.includes('workflow_status'));
        } finally {
          await client.end();
        }
      } finally {
        await db.destroy();
        await owner.query('DROP DATABASE ' + name + ' WITH (FORCE)');
      }
    }
  } finally {
    await owner.end();
  }
});
