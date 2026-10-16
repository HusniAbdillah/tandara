import { parse } from 'parse5';
import type { DefaultTreeAdapterTypes as Html } from 'parse5';
import { z } from 'zod';
import { waterObservationSchema, earthquakeObservationSchema } from '@tandara/contracts';
import type { WaterObservation, EarthquakeObservation } from '@tandara/contracts';

export const WATER_SOURCE_URL = 'https://poskobanjir.dsdadki.web.id/';
export const EARTHQUAKE_SOURCE_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json';
const MAX_BYTES = 2_000_000;
export interface ParsedObservations<T> {
  records: T[];
  skippedRecords: number;
}

function elements(node: Html.Node, tag: string): Html.Element[] {
  const result: Html.Element[] = [];
  if ('tagName' in node && node.tagName === tag) result.push(node);
  if ('childNodes' in node)
    for (const child of node.childNodes) result.push(...elements(child, tag));
  return result;
}
function attribute(node: Html.Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value ?? '';
}
function text(node: Html.Node): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value;
  return 'childNodes' in node
    ? node.childNodes.map(text).join(' ').replace(/\s+/g, ' ').trim()
    : '';
}
function numeric(value: string): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) throw new Error('Invalid observation number');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Invalid observation number');
  return n;
}
function waterTime(day: string, time: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(day);
  if (!match || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) throw new Error('Invalid observation time');
  // DSDA's table is Jakarta local time; never substitute fetch time for a reading.
  const local = `${match[3]}-${match[2]}-${match[1]}T${time.length === 5 ? time + ':00' : time}`;
  const iso = z.iso.datetime({ offset: true }).parse(local + '+07:00');
  const date = new Date(iso);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19) !== local
  )
    throw new Error('Invalid observation date');
  return date.toISOString();
}
function waterRow(row: Html.Element): WaterObservation {
  const cells = row.childNodes.filter(
    (child): child is Html.Element => 'tagName' in child && child.tagName === 'td',
  );
  if (cells.length !== 8) throw new Error('Water table columns changed');
  // Read literal popup arguments as data. Never evaluate the site's JavaScript.
  const handler = attribute(row, 'onclick');
  const match =
    /^\s*ShowPopup\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'[^']*'\s*\)\s*;?\s*$/.exec(
      handler,
    );
  if (!match) throw new Error('Water popup data changed');
  const marker = match[6]!.split(',');
  const stationId = marker.at(-1)?.trim();
  if (!stationId || !/^\d+$/.test(stationId)) throw new Error('Missing station ID');
  const statusImage = elements(cells[7]!, 'img')
    .map((image) => attribute(image, 'src'))
    .join(' ');
  const status = /icon-normal\./i.test(statusImage)
    ? 'normal'
    : /icon-siaga3\./i.test(statusImage)
      ? 'waspada'
      : /icon-siaga2\./i.test(statusImage)
        ? 'siaga'
        : /icon-siaga1\./i.test(statusImage)
          ? 'bahaya'
          : null;
  if (!status) throw new Error('Unknown water status');
  const rawThresholdsCm = {
    siaga1: numeric(match[3]!) / 10,
    siaga2: numeric(match[4]!) / 10,
    siaga3: numeric(match[5]!) / 10,
  };
  const { siaga1: high, siaga2: middle, siaga3: low } = rawThresholdsCm;
  // Equal/default thresholds cannot describe four meaningful ranges. Preserve raw values separately.
  const thresholds =
    low < middle && middle < high
      ? [
          { status: 'normal' as const, label: `≤ ${low} cm` },
          { status: 'waspada' as const, label: `>${low} sampai ${middle} cm` },
          { status: 'siaga' as const, label: `>${middle} sampai ${high} cm` },
          { status: 'bahaya' as const, label: `> ${high} cm` },
        ]
      : [];
  return waterObservationSchema.parse({
    id: 'dsda-' + stationId,
    name: text(cells[1]!),
    location: { latitude: numeric(marker[0] ?? ''), longitude: numeric(marker[1] ?? '') },
    heightCm: numeric(text(cells[3]!)),
    status,
    updatedAt: waterTime(text(cells[5]!), text(cells[6]!)),
    thresholds,
    rawThresholdsCm,
  });
}
export function parseWaterObservations(html: string): ParsedObservations<WaterObservation> {
  if (Buffer.byteLength(html) > MAX_BYTES) throw new Error('Water source too large');
  const rows = elements(parse(html, { scriptingEnabled: false }), 'tr').filter((row) =>
    /^\s*ShowPopup\(/.test(attribute(row, 'onclick')),
  );
  if (!rows.length || rows.length > 2000) throw new Error('Water table missing or oversized');
  const records: WaterObservation[] = [];
  const ids = new Set<string>();
  let skippedRecords = 0;
  for (const row of rows) {
    try {
      const record = waterRow(row);
      if (ids.has(record.id)) throw new Error('Duplicate station');
      ids.add(record.id);
      records.push(record);
    } catch {
      skippedRecords++;
    }
  }
  if (!records.length || skippedRecords > rows.length / 2)
    throw new Error('Water source format changed');
  return { records, skippedRecords };
}
export function parseEarthquakeObservations(
  json: string,
): ParsedObservations<EarthquakeObservation> {
  if (Buffer.byteLength(json) > MAX_BYTES) throw new Error('Earthquake source too large');
  const {
    Infogempa: { gempa },
  } = z
    .object({ Infogempa: z.object({ gempa: z.array(z.unknown()).min(1).max(1000) }) })
    .parse(JSON.parse(json));
  const records: EarthquakeObservation[] = [];
  const ids = new Set<string>();
  let skippedRecords = 0;
  for (const item of gempa) {
    try {
      const q = z
        .object({
          DateTime: z.iso.datetime({ offset: true }),
          Coordinates: z.string(),
          Magnitude: z.string(),
          Kedalaman: z.string(),
          Wilayah: z.string().trim().min(1).max(1000),
          Dirasakan: z.string().trim().max(4000),
        })
        .parse(item);
      const coordinate = q.Coordinates.split(',');
      if (coordinate.length !== 2) throw new Error('Invalid earthquake coordinates');
      const depth = /^\s*(\d+(?:\.\d+)?)\s*km\s*$/i.exec(q.Kedalaman);
      if (!depth) throw new Error('Invalid depth');
      const occurredAt = new Date(q.DateTime).toISOString();
      const record = earthquakeObservationSchema.parse({
        id: `bmkg-${occurredAt}-${coordinate.map((n) => numeric(n)).join(',')}`,
        location: { latitude: numeric(coordinate[0]!), longitude: numeric(coordinate[1]!) },
        occurredAt,
        magnitude: numeric(q.Magnitude),
        depthKm: numeric(depth[1]!),
        region: q.Wilayah,
        felt: q.Dirasakan,
      });
      if (!ids.has(record.id)) {
        ids.add(record.id);
        records.push(record);
      }
    } catch {
      skippedRecords++;
    }
  }
  if (!records.length || skippedRecords > gempa.length / 2)
    throw new Error('Earthquake source format changed');
  records.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return { records, skippedRecords };
}

export async function fetchObservationText(
  url: typeof WATER_SOURCE_URL | typeof EARTHQUAKE_SOURCE_URL,
  fetcher: typeof fetch,
): Promise<string> {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
    headers: {
      'User-Agent': 'Tandara/1.0 (public water levels and felt earthquakes)',
      Accept: url === WATER_SOURCE_URL ? 'text/html' : 'application/json',
    },
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('Observation source unavailable');
  }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {
    await response.body.cancel();
    throw new Error('Source too large');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Source too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}
