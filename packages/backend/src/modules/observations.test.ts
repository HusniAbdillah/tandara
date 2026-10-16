import { describe, expect, it } from 'vitest';
import type { Region } from '@tandara/contracts';
import { PendingObservationProvider } from './observations.js';

describe('pending observation provider', () => {
  it('never exposes example readings in production regions', async () => {
    const provider = new PendingObservationProvider();
    const feed = await provider.read({ simulation: false } as Region);
    expect(feed).toMatchObject({ mode: 'unconfigured', water: [], earthquakes: [] });
    expect(Number.isFinite(Date.parse(feed.fetchedAt))).toBe(true);
  });
  it('provides only the approved representative examples for simulation regions', async () => {
    const feed = await new PendingObservationProvider().read({ simulation: true } as Region);
    expect(feed.mode).toBe('simulation');
    expect(feed.water).toHaveLength(3);
    expect(feed.earthquakes).toHaveLength(1);
    expect(feed.water[0]).toMatchObject({
      name: 'Cantiga–Karang Tengah',
      heightCm: 57,
      updatedAt: '2026-10-15T13:00:00Z',
    });
    expect(feed.water[0]?.thresholds.map((t) => t.label)).toEqual([
      '<151 cm',
      '151–200 cm',
      '>200 cm',
    ]);
  });
});
