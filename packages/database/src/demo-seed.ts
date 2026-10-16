import { createDatabase } from './client.js';
import { seedDemoAccounts } from './demo-accounts.js';

if (process.env['APP_MODE'] !== 'simulation' || process.env['DEMO_LOGIN_ENABLED'] !== 'true')
  throw new Error('Demo account synchronization requires simulation and DEMO_LOGIN_ENABLED=true.');
const password = process.env['DEMO_PASSWORD'];
const connection = process.env['DATABASE_URL'];
if (!password || !connection) throw new Error('DATABASE_URL and DEMO_PASSWORD required.');
const { db } = createDatabase(connection);
try {
  await seedDemoAccounts(db, password, true);
  console.info('Demo accounts synchronized. Other accounts preserved.');
} finally {
  await db.destroy();
}
