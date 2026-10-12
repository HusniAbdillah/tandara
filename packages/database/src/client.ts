import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { ColumnType, JSONColumnType } from 'kysely';

export interface Database {
  app_metadata: {
    key: string;
    value: JSONColumnType<Record<string, unknown>>;
    updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  };
}

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    application_name: 'tandara',
  });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return { db, pool };
}
