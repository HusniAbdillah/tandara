import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { createDatabase } from '@tandara/database';
import { sql } from 'kysely';
import { ENVIRONMENT } from '../config/environment.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly db;

  constructor(@Inject(ENVIRONMENT) environment: Environment) {
    const { db, pool } = createDatabase(environment.DATABASE_URL);
    this.db = db;
    pool.on('error', () => {
      // Pool errors must have a listener. No connection credentials are logged.
      console.error('Unexpected idle database connection error.');
    });
  }

  async isReady(): Promise<boolean> {
    try {
      await sql`SELECT 1`.execute(this.db);
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
