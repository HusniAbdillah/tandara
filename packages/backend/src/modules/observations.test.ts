import { describe, expect, it } from 'vitest';
import type { Region } from '@tandara/contracts';
import { SimulationObservationProvider } from './observations.js';

describe('simulation observation provider', () => {
  it('never exposes example readings in production regions', async () => {
    const provider = new SimulationObservationProvider();
    const feed = await provider.read({ simulation: false } as Region);
    expect(feed).toMatchObject({ mode: 'unconfigured', water: [], earthquakes: [] });
    expect(Number.isFinite(Date.parse(feed.fetchedAt))).toBe(true);
  });
  it('provides only the approved representative examples for simulation regions', async () => {
    const feed = await new SimulationObservationProvider().read({ simulation: true } as Region);
    expect(feed.mode).toBe('simulation');
    expect(feed.water).toHaveLength(3);
    expect(feed.earthquakes).toHaveLength(1);
    expect(feed.water[0]).toMatchObject({
      name: 'Cantiga–Karang Tengah',
      heightCm: 57,
      updatedAt: '2026-10-15T13:00:00Z',
    });
    expect(feed.water[0]?.thresholds.map((t) => t.label)).toEqual([
      '≤ 150 cm',
      '>150 sampai 175 cm',
      '>175 sampai 200 cm',
      '> 200 cm',
    ]);
  });
});
