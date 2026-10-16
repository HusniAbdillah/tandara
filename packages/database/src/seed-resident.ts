import { createDatabase } from './client.js';
import { seedResidentReports } from './seed-workflow.js';

if (process.env['APP_MODE'] !== 'simulation')
  throw new Error('Demo resident reports allowed only in explicit simulation mode.');
const connection = process.env['DATABASE_URL'];
if (!connection) throw new Error('DATABASE_URL required');
const { db } = createDatabase(connection);
try {
  // Only add report fixtures; accounts and regions must already exist.
  await seedResidentReports(db);
  console.info('Resident report fixtures ready. Existing accounts and records preserved.');
} finally {
  await db.destroy();
}
