import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createDatabase } from '@tandara/database';
import { sql } from 'kysely';
import { ENVIRONMENT } from '../config/environment.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown, OnModuleInit {
  readonly db;

  constructor(@Inject(ENVIRONMENT) readonly environment: Environment) {
    const { db, pool } = createDatabase(environment.DATABASE_URL);
    this.db = db;
    pool.on('error', () => {
      // Pool errors must have a listener. No connection credentials are logged.
      console.error('Unexpected idle database connection error.');
    });
  }
  async onModuleInit() {
    if (this.environment.APP_MODE !== 'production') return;
    const simulated = (
      await sql`SELECT id FROM regions WHERE simulation UNION ALL SELECT id FROM reports WHERE simulation UNION ALL SELECT id FROM plan_versions WHERE simulation LIMIT 1`.execute(
        this.db,
      )
    ).rows.length;
    if (simulated)
      throw new Error('Production requires an isolated database without simulation data.');
    const owner = (
      await sql<{
        unsafe: boolean;
      }>`SELECT ((rolsuper OR rolbypassrls) OR EXISTS(SELECT 1 FROM pg_roles privileged WHERE pg_has_role(current_user,privileged.oid,'MEMBER') AND (privileged.rolsuper OR privileged.rolbypassrls OR privileged.rolname='rds_superuser')) OR EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='reports' AND tableowner=current_user)) unsafe FROM pg_roles WHERE rolname=current_user`.execute(
        this.db,
      )
    ).rows[0];
    if (owner?.unsafe)
      throw new Error('Production service database role must not be superuser or bypass RLS.');
    if (
      !(
        await sql<{
          relation: string | null;
        }>`SELECT to_regclass('ai_checkpoints.checkpoints') relation`.execute(this.db)
      ).rows[0]?.['relation']
    )
      throw new Error('Checkpoint migrations are required.');
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
