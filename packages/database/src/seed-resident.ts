import { createDatabase } from './client.js';
import { seedDemoResident } from './demo-resident.js';

if (process.env['APP_MODE'] !== 'simulation')
  throw new Error('Demo resident allowed only in explicit simulation mode.');
const connection = process.env['DATABASE_URL'];
if (!connection) throw new Error('DATABASE_URL required');
const { db } = createDatabase(connection);
try {
  await seedDemoResident(db);
  console.info('Demo resident ready. Existing accounts preserved.');
} finally {
  await db.destroy();
}
