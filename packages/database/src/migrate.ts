import { Migrator } from 'kysely/migration';
import * as foundation from './migrations/001_foundation.js';
import * as product from './migrations/002_product.js';
import * as indexes from './migrations/003_indexes.js';
import * as ai from './migrations/004_ai.js';
import * as security from './migrations/005_security.js';
import * as knowledge from './migrations/006_knowledge.js';
import * as governance from './migrations/007_ai_governance.js';
import * as delivery from './migrations/008_ai_delivery.js';
import * as warnings from './migrations/009_public_warnings.js';
import { createDatabase } from './client.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required. Copy .env.example to .env.');

// Extension/index DDL can legitimately take longer than an interactive API query.
const { db } = createDatabase(connectionString, { statementTimeoutMs: 120000 });
try {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return {
          '001_foundation': foundation,
          '002_product': product,
          '003_indexes': indexes,
          '004_ai': ai,
          '005_security': security,
          '006_knowledge': knowledge,
          '007_ai_governance': governance,
          '008_ai_delivery': delivery,
          '009_public_warnings': warnings,
        };
      },
    },
  });
  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    console.info(`${result.migrationName}: ${result.status}`);
  }
  if (error) throw error;
} finally {
  await db.destroy();
}
