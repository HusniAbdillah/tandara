import { afterEach, describe, expect, it, vi } from 'vitest';
import { BmkgSource, PetaBencanaSource, utcTimestamp } from './adapters.js';
import {
  BmkgNowcastSource,
  capUrl,
  parseCap,
  parsePublicXml,
  supersededIdentifiers,
} from './bmkg-nowcast.js';

const source = {
  id: '50000000-0000-4000-8000-000000000001',
  regionId: '20000000-0000-4000-8000-000000000001',
  name: 'BMKG',
  provider: 'bmkg_nowcast',
  mode: 'live',
  sourceUrl: 'https://data.bmkg.go.id/peringatan-dini-cuaca/',
  config: { province: 'DKI Jakarta' },
};
const url = 'https://www.bmkg.go.id/alerts/nowcast/id/CJK20261013003_alert.xml';
const sent = '2026-10-13T19:50:00+07:00';
const cap = (extra = '', polygon = '-6.23,106.84 -6.23,106.88 -6.20,106.88 -6.23,106.84') =>
  `<?xml version="1.0"?><alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>fixture-cap-1</identifier><sender>cuaca.ekstrem@bmkg.go.id</sender><sent>${sent}</sent><status>Actual</status><msgType>Alert</msgType><scope>Public</scope>${extra}<info><language>id</language><event>Hujan Lebat</event><headline>PERINGATAN SINTETIS UNTUK TEST</headline><description>Fixture test, bukan peringatan nyata.</description><effective>2026-10-13T20:00:00+07:00</effective><expires>2026-10-13T23:00:00+07:00</expires><area><areaDesc>Jakarta</areaDesc><polygon>${polygon}</polygon></area></info></alert>`;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('public-source provenance and scope', () => {
  it('preserves official issuance and validity without inventing observation time', () => {
    const record = parseCap(cap(), source, url)!;
    expect(record.sourceType).toBe('official_alert');
    expect(record.simulation).toBe(false);
    expect(record.issuedAt).toBe('2026-10-13T12:50:00.000Z');
    expect(record.effectiveAt).toBe('2026-10-13T13:00:00.000Z');
    expect(record.observedAt).toBeNull();
    expect(record.scopeGeometry?.type).toBe('GeometryCollection');
    expect(
      record.scopeGeometry?.type === 'GeometryCollection' &&
        record.scopeGeometry.geometries[0]?.coordinates,
    ).toEqual([
      [
        [106.84, -6.23],
        [106.88, -6.23],
        [106.88, -6.2],
        [106.84, -6.23],
      ],
    ]);
  });
  it.each(['Test', 'Exercise'])('does not import CAP %s as a real alert', (status) => {
    expect(parseCap(cap().replace('<status>Actual', '<status>' + status), source, url)).toBeNull();
  });
  it('excludes restricted CAP messages', () => {
    expect(parseCap(cap().replace('<scope>Public', '<scope>Restricted'), source, url)).toBeNull();
  });
  it('rejects entity expansion and malformed XML', () => {
    expect(() => parsePublicXml('<!DOCTYPE rss [<!ENTITY boom "x">]><rss/>')).toThrow();
    expect(() => parsePublicXml('<rss>')).toThrow();
  });
  it.each([
    'https://evil.test/alerts/nowcast/id/test_alert.xml',
    'http://www.bmkg.go.id/alerts/nowcast/id/test_alert.xml',
    url + '?redirect=1',
    'https://www.bmkg.go.id@evil.test/alerts/nowcast/id/test_alert.xml',
  ])('rejects untrusted CAP URL %s', (value) => {
    expect(() => capUrl(value)).toThrow();
  });
  it('rejects wrong province, missing polygon and invalid validity', () => {
    expect(() =>
      parseCap(cap().replace('Jakarta</areaDesc>', 'Aceh</areaDesc>'), source, url),
    ).toThrow();
    expect(() => parseCap(cap('', ''), source, url)).toThrow();
    expect(() => parseCap(cap().replace('23:00:00', '19:00:00'), source, url)).toThrow();
  });
  it('honors a cancellation even when the old alert is still present in RSS', async () => {
    const cancelUrl = url.replace('003', '004');
    const cancel = cap(
      `<references>cuaca.ekstrem@bmkg.go.id,fixture-cap-1,${sent}</references>`,
    ).replace('<msgType>Alert', '<msgType>Cancel');
    const rss = `<rss><channel><title>BMKG</title><item><title>Hujan di Jakarta</title><link>${url}</link></item><item><title>Hujan di Jakarta</title><link>${cancelUrl}</link></item></channel></rss>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (request: string) =>
          new Response(request.endsWith('/id') ? rss : request === cancelUrl ? cancel : cap()),
      ),
    );
    expect(supersededIdentifiers(cancel)).toEqual(['fixture-cap-1']);
    expect(await new BmkgNowcastSource().ingest(source)).toEqual([]);
  });
  it('accepts a complete empty RSS feed without manufacturing an alert', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<rss><channel><title>BMKG</title></channel></rss>')),
    );
    expect(await new BmkgNowcastSource().ingest(source)).toEqual([]);
  });
  it('preserves a crowd report publication time and expiry across refreshes and omits social PII', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          result: {
            type: 'FeatureCollection',
            features: [
              {
                geometry: { type: 'Point', coordinates: [106.86, -6.22] },
                properties: { pkey: '123', text: 'Nomor pribadi 08123456789', created_at: sent },
              },
            ],
          },
        }),
      ),
    );
    const [record] = await new PetaBencanaSource().ingest({
      ...source,
      config: { admin: 'ID-JK' },
    });
    expect(record?.issuedAt).toBe('2026-10-13T12:50:00.000Z');
    expect(record?.expiresAt).toBe('2026-10-13T13:50:00.000Z');
    expect(record?.body).not.toContain('08123456789');
    expect(record?.observedAt).toBeNull();
    expect(record?.scopeGeometry?.type).toBe('Point');
  });
  it('validates forecast administrative location and timezone', async () => {
    const response = {
      lokasi: { adm4: '31.75.03.1002', desa: 'Bidara Cina', kecamatan: 'Jatinegara' },
      data: [
        {
          cuaca: [
            [
              {
                analysis_date: '2026-10-13T12:00:00',
                utc_datetime: '2026-10-13 14:00:00',
                weather_desc: 'Cerah',
                t: 28,
                hu: 70,
              },
            ],
          ],
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(response)),
    );
    const [record] = await new BmkgSource().ingest({
      ...source,
      config: { adm4: '31.75.03.1002' },
    });
    expect(record?.body).toContain('Bidara Cina');
    expect(record?.issuedAt).toBe('2026-10-13T12:00:00.000Z');
    expect(record?.effectiveAt).toBe('2026-10-13T14:00:00.000Z');
    await expect(
      new BmkgSource().ingest({ ...source, config: { adm4: '31.75.03.1001' } }),
    ).rejects.toThrow();
    expect(utcTimestamp('2026-10-13T12:00:00Z')).toBe(record?.issuedAt);
  });
});
