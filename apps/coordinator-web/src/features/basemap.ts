import { z } from 'zod';
import type { StyleSpecification } from 'maplibre-gl';

const tileUrl = z
  .string()
  .max(1000)
  .refine((value) => {
    try {
      const url = new URL(value, window.location.origin);
      return (
        (url.protocol === 'https:' || url.origin === window.location.origin) &&
        ['{z}', '{x}', '{y}'].every((part) => value.includes(part)) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, 'URL tile HTTPS atau origin lokal dengan {z}/{x}/{y} diperlukan.');
const basemapSchema = z
  .object({
    enabled: z.boolean(),
    label: z.string().min(1).max(80),
    tiles: z.array(tileUrl).min(1).max(3),
    attributionLabel: z.string().min(1).max(150),
    attributionUrl: z.url().refine((value) => new URL(value).protocol === 'https:'),
    maxZoom: z.number().int().min(1).max(22),
  })
  .strict();
export type Basemap = z.infer<typeof basemapSchema>;

export async function loadBasemap(): Promise<Basemap> {
  // Runtime public configuration, separate from private report/session requests.
  const response = await fetch('/basemap.json', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Konfigurasi peta dasar tidak tersedia.');
  return basemapSchema.parse(await response.json());
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

export function basemapStyle(config?: Basemap): StyleSpecification {
  return {
    version: 8,
    sources: config?.enabled
      ? {
          basemap: {
            type: 'raster',
            tiles: config.tiles,
            tileSize: 256,
            maxzoom: config.maxZoom,
            attribution: `<a href="${escapeHtml(config.attributionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(config.attributionLabel)}</a>`,
          },
        }
      : {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ecf0e6' } },
      ...(config?.enabled
        ? [
            {
              id: 'basemap-raster',
              type: 'raster' as const,
              source: 'basemap',
              paint: { 'raster-fade-duration': 0 },
            },
          ]
        : []),
    ],
  };
}
