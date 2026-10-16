import { describe, expect, it } from 'vitest';
import { ResidentsService } from './residents.js';
import { DatabaseService } from '../platform/database.service.js';
import { parseEnvironment } from '../config/environment.js';

describe('public demo account picker', () => {
  it('exposes only the reserved demo catalog after explicit opt-in in simulation', async () => {
    const base = {
      DATABASE_URL: 'postgres://test:test@localhost/demo',
      REDIS_URL: 'redis://localhost',
      DEMO_PASSWORD: 'synthetic-demo-password',
    };
    for (const enabled of ['true', 'false'] as const) {
      const database = new DatabaseService(
        parseEnvironment({ ...base, DEMO_LOGIN_ENABLED: enabled }),
      );
      try {
        const catalog = new ResidentsService(database).demoLogin();
        if (enabled === 'false') expect(catalog).toBeNull();
        else {
          expect(catalog?.password).toBe(base.DEMO_PASSWORD);
          expect(catalog?.coordinators).toHaveLength(3);
          expect(catalog?.residents.map((account) => account.name)).toEqual([
            'Rani Ciliwung',
            'Budi Semarang',
          ]);
        }
      } finally {
        await database.db.destroy();
      }
    }
  });
});
