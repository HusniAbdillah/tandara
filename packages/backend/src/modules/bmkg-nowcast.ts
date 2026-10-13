import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { informationSchema } from '@tandara/contracts';
import { fetchText, sourceBase } from './adapters.js';
import type { SourceAdapter, SourceInput, SourceRecord } from './adapters.js';

export const BMKG_NOWCAST_FEED = 'https://www.bmkg.go.id/alerts/nowcast/id';
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^dkijakarta$/, 'jakarta')
    .replace(/^kepulauanriau$/, 'kepriau');
const sourceHeaders = { 'User-Agent': 'Tandara/1.0 (community preparedness; BMKG attribution)' };
export function parsePublicXml(xml: string): unknown {
  if (
    Buffer.byteLength(xml) > 2000000 ||
    /<!\s*(DOCTYPE|ENTITY)/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new Error('Invalid or unsafe source XML');
  return new XMLParser({
    removeNSPrefix: true,
    parseTagValue: false,
    processEntities: false,
  }).parse(xml) as unknown;
}
function list(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
export function capUrl(value: string): string {
  const url = new URL(value);
  if (
    url.origin !== 'https://www.bmkg.go.id' ||
    !/^\/alerts\/nowcast\/id\/[A-Za-z0-9_-]+_alert\.xml$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Untrusted CAP URL');
  return url.href;
}
function timestamp(value: unknown): string {
  const text = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
    .parse(value);
  if (!Number.isFinite(Date.parse(text))) throw new Error('Invalid CAP time');
  return new Date(text).toISOString();
}
export function parseCap(xml: string, source: SourceInput, url: string): SourceRecord | null {
  const { alert } = z
    .object({
      alert: z.object({
        identifier: z.string().min(1).max(200),
        sender: z.string(),
        sent: z.string(),
        status: z.string(),
        scope: z.string(),
        msgType: z.string(),
        info: z.unknown().optional(),
      }),
    })
    .parse(parsePublicXml(xml));
  if (alert.status !== 'Actual' || alert.scope !== 'Public') return null;
  if (alert.msgType === 'Cancel') return null; // Complete RSS snapshots retire prior warnings in the worker.
  if (!['Alert', 'Update'].includes(alert.msgType)) return null;
  const infos = list(alert.info).map((v) =>
    z
      .object({
        language: z.string().optional(),
        event: z.string().max(300),
        headline: z.string().max(500),
        description: z.string().max(20000),
        effective: z.string(),
        expires: z.string(),
        area: z.unknown(),
      })
      .parse(v),
  );
  const info = infos.find((i) => i.language === 'id' || i.language === 'id-ID');
  if (!info) throw new Error('Indonesian CAP information missing');
  const province = z.string().trim().min(3).max(100).parse(source.config['province']);
  const areas = list(info.area)
    .map((v) => z.object({ areaDesc: z.string(), polygon: z.unknown().optional() }).parse(v))
    .filter((area) => normalize(area.areaDesc) === normalize(province));
  if (!areas.length) throw new Error('CAP province does not match configuration');
  const polygons = areas
    .flatMap((area) => list(area.polygon))
    .map((v) => {
      const pairs = z.string().max(500000).parse(v).trim().split(/\s+/);
      if (pairs.length < 4 || pairs.length > 10000) throw new Error('Invalid CAP polygon');
      const ring = pairs.map((pair) => {
        const parts = pair.split(',');
        if (parts.length !== 2 || parts.some((p) => !p.trim()))
          throw new Error('Invalid CAP coordinate');
        const [lat, lon] = z
          .tuple([z.coerce.number().min(-90).max(90), z.coerce.number().min(-180).max(180)])
          .parse(parts);
        return [lon, lat]; // CAP latitude,longitude -> GeoJSON longitude,latitude.
      });
      if (JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1)))
        throw new Error('CAP polygon is not closed');
      return [ring];
    });
  if (!polygons.length || polygons.length > 100)
    throw new Error('CAP geographic scope missing or too large');
  const issuedAt = timestamp(alert.sent);
  const effectiveAt = timestamp(info.effective);
  const expiresAt = timestamp(info.expires);
  if (
    Date.parse(expiresAt) <= Date.parse(effectiveAt) ||
    Date.parse(issuedAt) > Date.now() + 300000
  )
    throw new Error('Invalid CAP validity window');
  return {
    ...informationSchema.parse({
      ...sourceBase(source),
      sourceName: 'BMKG · peringatan dini cuaca',
      sourceUrl: capUrl(url),
      title: info.headline,
      body: 'Cakupan sumber: ' + province + '. ' + info.description,
      sourceType: 'official_alert',
      issuedAt,
      effectiveAt,
      expiresAt,
      version: alert.identifier,
      verificationStatus: 'official_cap_actual_public',
    }),
    // CAP areas may legitimately overlap; a MultiPolygon would make those invalid.
    scopeGeometry: {
      type: 'GeometryCollection',
      geometries: polygons.map((coordinates) => ({ type: 'Polygon', coordinates })),
    },
  };
}
export function supersededIdentifiers(xml: string): string[] {
  const { alert } = z
    .object({
      alert: z.object({
        status: z.string(),
        scope: z.string(),
        msgType: z.string(),
        references: z.string().optional(),
      }),
    })
    .parse(parsePublicXml(xml));
  if (
    alert.status !== 'Actual' ||
    alert.scope !== 'Public' ||
    !['Update', 'Cancel'].includes(alert.msgType)
  )
    return [];
  if (!alert.references) throw new Error('CAP update or cancellation references missing');
  return alert.references
    .trim()
    .split(/\s+/)
    .map((reference) => {
      const parts = reference.split(',');
      if (parts.length !== 3 || !parts[1]) throw new Error('Invalid CAP reference');
      timestamp(parts[2]);
      return parts[1];
    });
}
export class BmkgNowcastSource implements SourceAdapter {
  async ingest(source: SourceInput): Promise<SourceRecord[]> {
    const province = z.string().trim().min(3).max(100).parse(source.config['province']);
    const rss = z
      .object({
        rss: z.object({ channel: z.object({ title: z.string(), item: z.unknown().optional() }) }),
      })
      .parse(parsePublicXml(await fetchText(BMKG_NOWCAST_FEED, { headers: sourceHeaders })));
    const items = list(rss.rss.channel.item).map((v) =>
      z.object({ title: z.string(), link: z.string() }).parse(v),
    );
    if (items.length > 100) throw new Error('RSS feed too large');
    const matched = items.filter((item) =>
      normalize(item.title).endsWith('di' + normalize(province)),
    );
    if (matched.length > 8) throw new Error('CAP feed exceeds complete bounded import');
    const records: SourceRecord[] = [];
    const superseded = new Set<string>();
    for (const item of matched) {
      const url = capUrl(item.link);
      const xml = await fetchText(url, { headers: sourceHeaders });
      const record = parseCap(xml, source, url);
      for (const identifier of supersededIdentifiers(xml)) superseded.add(identifier);
      if (record) records.push(record);
    }
    return records.filter((record) => !superseded.has(record.version));
  }
}
