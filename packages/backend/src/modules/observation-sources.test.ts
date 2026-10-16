import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveObservationProvider } from './live-observations.js';
import {
  WATER_SOURCE_URL,
  EARTHQUAKE_SOURCE_URL,
  fetchObservationText,
  parseWaterObservations,
  parseEarthquakeObservations,
} from './observation-sources.js';

function waterRow({
  id = '167',
  name = 'Rumah Pompa Pluit 1',
  height = '-167',
  status = 'normal',
  thresholds = ['450', '0', '-500'],
  time = '13:30',
} = {}) {
  return `<tr onclick="ShowPopup(&#39;${name}&#39;,&#39;${Number(height) * 10}&#39;,&#39;${thresholds[0]}&#39;,&#39;${thresholds[1]}&#39;,&#39;${thresholds[2]}&#39;,&#39;-6.109552,106.797342,${name},0,Status : Normal,${id}&#39;,&#39;Proses Pemetaan&#39;)"><td>1</td><td>${name}</td><td>Waduk Pluit</td><td><span>${height}</span></td><td><img src="up.gif"></td><td>16/10/2026</td><td>${time}</td><td><img src="images/icon/icon-${status}.gif"></td></tr>`;
}
const waterHtml = (...rows: string[]) =>
  '<!doctype html><html><body><table>' + rows.join('') + '</table></body></html>';
const event = {
  Tanggal: '16 Okt 2026',
  Jam: '10:21:55 WIB',
  DateTime: '2026-10-16T10:21:55+07:00',
  Coordinates: '-6.69,106.63',
  Magnitude: '2.5',
  Kedalaman: '9 km',
  Wilayah: 'Pusat gempa berada di darat 21 km Barat Daya Kota Bogor',
  Dirasakan: 'II Kabandungan',
};
const quakeJson = (events: unknown[] = [event]) => JSON.stringify({ Infogempa: { gempa: events } });
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('public map observation normalization', () => {
  it('reads station IDs, real coordinates, negative centimetres, four ranges, and Jakarta measurement time', () => {
    const {
      records: [record],
      skippedRecords,
    } = parseWaterObservations(waterHtml(waterRow()));
    expect(skippedRecords).toBe(0);
    expect(record).toMatchObject({
      id: 'dsda-167',
      name: 'Rumah Pompa Pluit 1',
      heightCm: -167,
      status: 'normal',
      location: { latitude: -6.109552, longitude: 106.797342 },
      updatedAt: '2026-10-16T06:30:00.000Z',
      rawThresholdsCm: { siaga1: 45, siaga2: 0, siaga3: -50 },
    });
    expect(record?.thresholds).toEqual([
      { status: 'normal', label: '≤ -50 cm' },
      { status: 'waspada', label: '>-50 sampai 0 cm' },
      { status: 'siaga', label: '>0 sampai 45 cm' },
      { status: 'bahaya', label: '> 45 cm' },
    ]);
  });
  it.each([
    ['normal', 'normal'],
    ['siaga3', 'waspada'],
    ['siaga2', 'siaga'],
    ['siaga1', 'bahaya'],
  ])('preserves published %s status', (image, status) => {
    expect(parseWaterObservations(waterHtml(waterRow({ status: image }))).records[0]?.status).toBe(
      status,
    );
  });
  it('keeps ambiguous thresholds as raw data without inventing ranges', () => {
    const record = parseWaterObservations(
      waterHtml(waterRow({ thresholds: ['5000', '5000', '5000'] })),
    ).records[0];
    expect(record?.thresholds).toEqual([]);
    expect(record?.rawThresholdsCm).toEqual({ siaga1: 500, siaga2: 500, siaga3: 500 });
  });
  it('decodes HTML entities and does not execute any upstream script', () => {
    const record = parseWaterObservations(
      waterHtml(waterRow({ name: 'Pintu &amp; Pompa' })) +
        '<script>throw new Error("never execute")</script>',
    ).records[0];
    expect(record?.name).toBe('Pintu & Pompa');
  });
  it('isolates malformed rows and rejects completely changed pages', () => {
    const result = parseWaterObservations(
      waterHtml(waterRow(), waterRow({ id: '168', time: 'n/a' })),
    );
    expect(result.records).toHaveLength(1);
    expect(result.skippedRecords).toBe(1);
    expect(() => parseWaterObservations('<html>Maintenance</html>')).toThrow();
    expect(() => parseWaterObservations(waterHtml(waterRow({ status: 'unknown' })))).toThrow();
    expect(() =>
      parseWaterObservations(waterHtml(waterRow()).replace('16/10/2026', '31/02/2026')),
    ).toThrow();
  });
  it('maps BMKG units and coordinate order, normalizes UTC/offset instants, and deduplicates', () => {
    const { records } = parseEarthquakeObservations(
      quakeJson([event, { ...event, DateTime: '2026-10-16T03:21:55+00:00' }]),
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      occurredAt: '2026-10-16T03:21:55.000Z',
      location: { latitude: -6.69, longitude: 106.63 },
      magnitude: 2.5,
      depthKm: 9,
      region: event.Wilayah,
      felt: 'II Kabandungan',
    });
  });
  it('skips invalid earthquake coordinates and depth without corrupting good events', () => {
    const result = parseEarthquakeObservations(
      quakeJson([event, { ...event, Coordinates: '-600,106' }]),
    );
    expect(result.records).toHaveLength(1);
    expect(result.skippedRecords).toBe(1);
    expect(() =>
      parseEarthquakeObservations(quakeJson([{ ...event, Kedalaman: 'unknown' }])),
    ).toThrow();
    expect(() => parseEarthquakeObservations('{}')).toThrow();
  });
});

describe('cached independent public map feeds', () => {
  function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T07:00:00Z'));
    let waterFails = false,
      quakeFails = false;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (input === WATER_SOURCE_URL) {
        if (waterFails) throw new Error('offline');
        return new Response(waterHtml(waterRow()));
      }
      if (input === EARTHQUAKE_SOURCE_URL) {
        if (quakeFails) return new Response('unavailable', { status: 503 });
        return new Response(quakeJson());
      }
      throw new Error('Unexpected URL');
    });
    return {
      provider: new LiveObservationProvider(fetcher),
      fetcher,
      failWater: () => {
        waterFails = true;
      },
      failQuakes: () => {
        quakeFails = true;
      },
    };
  }
  it('shares in-flight fetches and a one-minute cache between simultaneous callers', async () => {
    const { provider, fetcher } = setup();
    const feeds = await Promise.all(Array.from({ length: 25 }, () => provider.read()));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(feeds[0]?.sources.map((s) => s.status)).toEqual(['ready', 'ready']);
    await provider.read();
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60001);
    await provider.read();
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
  });
  it('retains last good water with stale metadata while earthquakes keep refreshing', async () => {
    const { provider, fetcher, failWater } = setup();
    const first = await provider.read();
    failWater();
    vi.advanceTimersByTime(60001);
    const next = await provider.read();
    expect(next.water).toEqual(first.water);
    expect(next.sources[0]).toMatchObject({
      status: 'stale',
      lastSuccessAt: first.sources[0]?.lastSuccessAt,
    });
    expect(next.sources[1]?.status).toBe('ready');
    await provider.read();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('does not manufacture demo data on cold failures or retain snapshots over 24 hours', async () => {
    const { provider, failWater, failQuakes } = setup();
    failWater();
    const initial = await provider.read();
    expect(initial.water).toEqual([]);
    expect(initial.earthquakes).toHaveLength(1);
    expect(initial.sources[0]).toMatchObject({ status: 'unavailable', lastSuccessAt: null });
    failQuakes();
    vi.advanceTimersByTime(24 * 3600000 + 1);
    const expired = await provider.read();
    expect(expired.earthquakes).toEqual([]);
    expect(expired.sources[1]?.status).toBe('unavailable');
  });
  it('rejects oversized responses before parsing', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response('oversized', { headers: { 'content-length': '2000001' } }),
    );
    await expect(fetchObservationText(WATER_SOURCE_URL, fetcher)).rejects.toThrow(
      'Source too large',
    );
    const chunked = vi.fn<typeof fetch>(async () => new Response('x'.repeat(2000001)));
    await expect(fetchObservationText(WATER_SOURCE_URL, chunked)).rejects.toThrow(
      'Source too large',
    );
  });
});
