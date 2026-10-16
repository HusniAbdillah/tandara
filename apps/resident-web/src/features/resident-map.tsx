import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import type * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { observationsSchema } from '@tandara/contracts';
import type { Region, Plan, WaterObservation, EarthquakeObservation } from '@tandara/contracts';
import { WButton, WEmpty, WError, WIcon, WRow } from './chalk-ui.js';
import type { ResidentData } from './resident-data.js';
import { designAssets } from './design-assets.js';

export type MapPoint = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  accessibility?: string;
};
type MapPin = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  type: 'place' | 'water' | 'earthquake' | 'report' | 'picked';
  status?: string;
};
export function planPoints(plan?: Plan): MapPoint[] {
  return plan?.content.points.map((point, i) => ({ ...point, id: 'place-' + i })) ?? [];
}
export function regionCenter(region?: Region): [number, number] {
  const coordinates = region?.boundary.coordinates[0];
  if (!coordinates?.length) return [106.866, -6.228];
  return [
    coordinates.reduce((sum, p) => sum + p[0]!, 0) / coordinates.length,
    coordinates.reduce((sum, p) => sum + p[1]!, 0) / coordinates.length,
  ];
}
const basemapSchema = z.object({
  tiles: z
    .array(
      z.string().refine((value) => {
        try {
          const url = new URL(value, window.location.origin);
          return (
            (url.protocol === 'https:' || url.origin === window.location.origin) &&
            !url.username &&
            !url.password &&
            ['{z}', '{x}', '{y}'].every((part) => value.includes(part))
          );
        } catch {
          return false;
        }
      }),
    )
    .min(1)
    .max(3),
  attribution: z.string().max(150),
  attributionUrl: z.url().refine((value) => new URL(value).protocol === 'https:'),
  maxZoom: z.number().int().min(1).max(22),
});
export function StreetMap({
  region,
  points = [],
  pins = [],
  onSelect,
  selected,
  onPick,
  picked,
  compact = false,
}: {
  region?: Region | undefined;
  points?: MapPoint[];
  pins?: MapPin[];
  onSelect?: (id: string, type: string) => void;
  selected?: { latitude: number; longitude: number } | undefined;
  onPick?: (point: { latitude: number; longitude: number }) => void;
  picked?: { latitude: number; longitude: number } | undefined;
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<maplibregl.Map | null>(null);
  const libraryRef = useRef<typeof maplibregl | null>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const center = regionCenter(region);
  const longitude = center[0],
    latitude = center[1];
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    const controller = new AbortController();
    let resize: ResizeObserver | undefined;
    void (async () => {
      const maplibregl = await import('maplibre-gl');
      libraryRef.current = maplibregl;
      const response = await fetch('/basemap.json', { signal: controller.signal });
      if (!response.ok) throw new Error('Konfigurasi peta belum tersedia.');
      const config = basemapSchema.parse(await response.json());
      if (disposed || !container.current) return;
      const map = new maplibregl.Map({
        container: container.current,
        center: [longitude, latitude],
        zoom: compact ? 14 : 14.5,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            streets: {
              type: 'raster',
              tiles: config.tiles,
              tileSize: 256,
              maxzoom: config.maxZoom,
            },
          },
          layers: [
            { id: 'paper', type: 'background', paint: { 'background-color': '#f1f0e8' } },
            {
              id: 'streets',
              type: 'raster',
              source: 'streets',
              paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.85 },
            },
          ],
        },
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.AttributionControl({
          customAttribution: `<a href="${new URL(config.attributionUrl).href.replaceAll('"', '%22')}" target="_blank" rel="noreferrer">${config.attribution.replace(/[<>&"']/g, '')}</a>`,
          compact: true,
        }),
        'bottom-right',
      );
      if (!compact)
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        'bottom-right',
      );
      map.on('click', (e) =>
        pickRef.current?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }),
      );
      map.on('load', () => {
        if (!disposed) {
          setError('');
          window.dispatchEvent(new Event('tandara:map-ready'));
        }
      });
      map.on('error', () => {
        if (!disposed && !map.isStyleLoaded()) setError('Peta belum dapat dimuat.');
      });
      resize = new ResizeObserver(() => map.resize());
      resize.observe(container.current);
      window.dispatchEvent(new Event('tandara:map-created'));
    })().catch(() => {
      if (!disposed) setError('Peta belum dapat dimuat.');
    });
    return () => {
      disposed = true;
      controller.abort();
      resize?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [longitude, latitude, compact, retry]);
  useEffect(() => {
    let markers: maplibregl.Marker[] = [];
    const render = () => {
      markers.forEach((marker) => marker.remove());
      markers = [];
      const map = mapRef.current;
      const library = libraryRef.current;
      if (!map || !library) return;
      const all: MapPin[] = [
        ...points.map((point) => ({ ...point, type: 'place' as const, label: point.name })),
        ...pins,
        ...(picked
          ? [{ ...picked, id: 'picked', type: 'picked' as const, label: 'Lokasi kejadian' }]
          : []),
      ];
      for (const pin of all) {
        const el = document.createElement(onSelect ? 'button' : 'div');
        if (el instanceof HTMLButtonElement) el.type = 'button';
        else el.setAttribute('role', 'img');
        el.className = `w-map-pin pin-${pin.type} ${pin.status ?? ''}`;
        el.setAttribute('aria-label', pin.label);
        el.title = pin.label;
        const img = document.createElement('img');
        img.src =
          '/design/' +
          (pin.type === 'place'
            ? designAssets.IconBuilding2
            : pin.type === 'water'
              ? designAssets.IconDroplets
              : designAssets.IconMapPin1);
        img.width = 20;
        img.height = 20;
        img.alt = '';
        el.appendChild(img);
        if (pin.type === 'water' || pin.type === 'earthquake' || pin.type === 'report') {
          const span = document.createElement('span');
          span.textContent = pin.label;
          el.appendChild(span);
        }
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect?.(pin.id, pin.type);
        });
        markers.push(
          new library.Marker({ element: el }).setLngLat([pin.longitude, pin.latitude]).addTo(map),
        );
      }
    };
    render();
    window.addEventListener('tandara:map-created', render);
    return () => {
      window.removeEventListener('tandara:map-created', render);
      markers.forEach((marker) => marker.remove());
    };
  }, [points, pins, picked, onSelect, retry, longitude, latitude, compact]);
  useEffect(() => {
    const focus = () => {
      if (selected)
        mapRef.current?.flyTo({
          center: [selected.longitude, selected.latitude],
          zoom: 14,
          essential: false,
        });
    };
    focus();
    window.addEventListener('tandara:map-created', focus);
    return () => window.removeEventListener('tandara:map-created', focus);
  }, [selected]);
  return (
    <div className={`w-street-map ${compact ? 'is-compact' : ''}`}>
      <div ref={container} className="w-map-canvas" role="region" aria-label="Peta wilayah" />
      {error && (
        <div className="w-map-error">
          <span>{error}</span>
          <WButton
            secondary
            onClick={() => {
              setError('');
              setRetry((n) => n + 1);
            }}
          >
            Coba lagi
          </WButton>
        </div>
      )}
    </div>
  );
}
const statusNames = {
  normal: 'Normal',
  waspada: 'Waspada',
  siaga: 'Siaga',
  bahaya: 'Bahaya',
  unknown: 'Belum diketahui',
};
function waterDisplayStatus(water: WaterObservation) {
  return water.thresholds.length === 4 ? water.status : 'unknown';
}
export function observationTime(value: string, seconds = false) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  }).format(new Date(value));
}
export function WaterDetail({ water }: { water: WaterObservation }) {
  const status = waterDisplayStatus(water);
  return (
    <div className="w-observation">
      <small>Lokasi pengamatan</small>
      <h3>{water.name}</h3>
      <div className="w-observation-value">
        <strong>{water.heightCm} cm</strong>
        <span className={`w-status ${status}`}>{statusNames[status]}</span>
      </div>
      <small>Diperbarui {observationTime(water.updatedAt)} WIB</small>
      <h3>Batas ketinggian</h3>
      {!water.thresholds.length && <p className="w-muted">Belum tersedia</p>}
      <dl className="w-thresholds">
        {water.thresholds.map((t) => (
          <div key={t.status}>
            <dt className={`w-status ${t.status}`}>{statusNames[t.status]}</dt>
            <dd>{t.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
export function EarthquakeDetail({ quake }: { quake: EarthquakeObservation }) {
  return (
    <div className="w-observation">
      <h2>Gempa M {quake.magnitude}</h2>
      <small>{observationTime(quake.occurredAt, true)} WIB</small>
      <dl className="w-quake-metrics">
        <div>
          <dt>Magnitudo</dt>
          <dd>{quake.magnitude}</dd>
        </div>
        <div>
          <dt>Kedalaman</dt>
          <dd>{quake.depthKm} km</dd>
        </div>
      </dl>
      <dl className="w-quake-details">
        <div>
          <dt>Wilayah</dt>
          <dd>{quake.region}</dd>
        </div>
        <div>
          <dt>Koordinat</dt>
          <dd>
            {quake.location.latitude}, {quake.location.longitude}
          </dd>
        </div>
        <div>
          <dt>Dirasakan</dt>
          <dd>{quake.felt || 'Belum tersedia'}</dd>
        </div>
      </dl>
    </div>
  );
}
function withinRadius(
  point: { latitude: number; longitude: number },
  center: [number, number],
  radius: number | null,
) {
  if (radius === null) return true;
  const radians = Math.PI / 180;
  const a =
    Math.sin(((point.latitude - center[1]) * radians) / 2) ** 2 +
    Math.cos(point.latitude * radians) *
      Math.cos(center[1] * radians) *
      Math.sin(((point.longitude - center[0]) * radians) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radius;
}
export function MapPage({ app }: { app: ResidentData }) {
  const [params, setParams] = useSearchParams();
  const panel = params.get('panel'),
    id = params.get('id');
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState<number | null>(null);
  const center = useMemo(() => regionCenter(app.region), [app.region]);
  const [nearby, setNearby] = useState(true),
    [waterVisible, setWaterVisible] = useState(true),
    [quakeVisible, setQuakeVisible] = useState(true);
  const feed = useQuery({
    queryKey: ['observations', app.activeRegion],
    enabled: !!app.activeRegion,
    queryFn: ({ signal }) =>
      request('/regions/' + app.activeRegion + '/observations', observationsSchema, { signal }),
    refetchInterval: app.online ? 60000 : false,
  });
  const points = useMemo(() => planPoints(app.plan), [app.plan]);
  const water = feed.data?.water.find((x) => x.id === id),
    quake = feed.data?.earthquakes.find((x) => x.id === id),
    place = points.find((x) => x.id === id);
  const publicReport = app.data.data?.reports.find((report) => report.id === id);
  const query = search.toLocaleLowerCase('id');
  const waters =
    feed.data?.water.filter((x) => x.name.toLocaleLowerCase('id').includes(query)) ?? [];
  const quakes =
    feed.data?.earthquakes.filter((x) => x.region.toLocaleLowerCase('id').includes(query)) ?? [];
  const places = points.filter((x) => x.name.toLocaleLowerCase('id').includes(query));
  const publicReports =
    app.data.data?.reports.filter((report) =>
      (report.summary + ' ' + (report.landmarkText ?? '')).toLocaleLowerCase('id').includes(query),
    ) ?? [];
  const reportPins = useMemo<MapPin[]>(
    () =>
      (app.data.data?.reports ?? [])
        .filter((report) => report.location)
        .map((report) => ({
          id: report.id,
          ...report.location!,
          label: report.summary,
          type: 'report' as const,
        })),
    [app.data.data?.reports],
  );
  function open(next: string, nextId?: string) {
    setParams({ panel: next, ...(nextId ? { id: nextId } : {}) });
  }
  const pins = useMemo<MapPin[]>(
    () => [
      ...(waterVisible
        ? (feed.data?.water.map((x) => ({
            id: x.id,
            ...x.location,
            label: x.heightCm + ' cm',
            type: 'water' as const,
            status: waterDisplayStatus(x),
          })) ?? [])
        : []),
      ...(quakeVisible
        ? (feed.data?.earthquakes.map((x) => ({
            id: x.id,
            ...x.location,
            label: 'M ' + x.magnitude,
            type: 'earthquake' as const,
          })) ?? [])
        : []),
      ...reportPins,
    ],
    [feed.data, waterVisible, quakeVisible, reportPins],
  );
  const visiblePins = pins.filter((pin) => withinRadius(pin, center, radius));
  const visiblePoints = points.filter((point) => withinRadius(point, center, radius));
  const panelSources =
    feed.data?.sources.filter((source) =>
      panel === 'water'
        ? source.id === 'dsda'
        : panel === 'earthquakes'
          ? source.id === 'bmkg'
          : true,
    ) ?? [];
  const selected =
    water?.location ?? quake?.location ?? place ?? publicReport?.location ?? undefined;
  const panelTitle =
    panel === 'water'
      ? 'Tinggi air'
      : panel === 'earthquakes'
        ? 'Gempa'
        : panel === 'place'
          ? 'Lokasi'
          : panel === 'search'
            ? 'Hasil pencarian'
            : panel === 'report'
              ? 'Laporan warga'
              : 'Filter & legenda';
  return (
    <div className={`w-map-page ${panel ? 'has-panel' : ''}`}>
      <StreetMap
        region={app.region}
        points={nearby ? visiblePoints : []}
        pins={visiblePins}
        selected={selected}
        onSelect={(nextId, type) =>
          open(
            type === 'water'
              ? 'water'
              : type === 'earthquake'
                ? 'earthquakes'
                : type === 'report'
                  ? 'report'
                  : 'place',
            nextId,
          )
        }
      />
      {!!feed.data?.sources.length && (
        <div className="w-map-source-credit" aria-label="Sumber data pengamatan">
          {feed.data.sources.map((source) => (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
              {source.name}
            </a>
          ))}
        </div>
      )}
      <div className="w-map-toolbar">
        <form
          className="w-map-search"
          onSubmit={(e) => {
            e.preventDefault();
            open('search');
          }}
        >
          <WIcon name="search" size={20} />
          <input
            aria-label="Cari tempat atau laporan"
            placeholder="Cari tempat atau laporan"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) open('search');
            }}
          />
        </form>
        <WButton secondary onClick={() => open('filters')}>
          <WIcon name="filter" size={20} />
          Filter & legenda
        </WButton>
      </div>
      {!panel && (
        <Link className="w-map-report w-button" to="/report">
          <WIcon name="plus" />
          Buat laporan
        </Link>
      )}
      {panel && (
        <aside className="w-map-panel" aria-label={panelTitle}>
          <div className="w-map-panel-header">
            <button
              aria-label={id ? 'Kembali ke daftar' : 'Tutup panel'}
              className="w-icon-button"
              onClick={() =>
                id ? open(['place', 'report'].includes(panel) ? 'search' : panel) : setParams({})
              }
            >
              <WIcon name={id ? 'back' : 'close'} />
            </button>
            <h2>{panelTitle}</h2>
          </div>
          <div className="w-map-panel-body">
            {!!panelSources.length && (
              <div className="w-observation-sources">
                {panelSources.map((source) => (
                  <div key={source.id}>
                    <small>
                      Sumber:{' '}
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.name}
                      </a>
                    </small>
                    {source.status !== 'ready' && (
                      <p role="status">
                        {source.status === 'stale'
                          ? 'Menampilkan data terakhir'
                          : 'Sumber belum dapat diakses'}
                      </p>
                    )}
                  </div>
                ))}
                {panelSources.some((source) => source.status !== 'ready') && (
                  <WButton secondary onClick={() => void feed.refetch()}>
                    Coba lagi
                  </WButton>
                )}
              </div>
            )}
            {panel === 'filters' ? (
              <>
                <div className="w-filter-toggles">
                  {[
                    ['Lokasi sekitar', 'Titik kumpul, Posko, laporan', nearby, setNearby],
                    ['Tinggi air', '', waterVisible, setWaterVisible],
                    ['Gempa', '', quakeVisible, setQuakeVisible],
                  ].map(([title, subtitle, checked, setter]) => (
                    <label className="w-switch-row" key={String(title)}>
                      <span>
                        <strong>{String(title)}</strong>
                        {subtitle && <small>{String(subtitle)}</small>}
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={Boolean(checked)}
                        onChange={(e) => (setter as (checked: boolean) => void)(e.target.checked)}
                        aria-label={String(title)}
                      />
                    </label>
                  ))}
                </div>
                <div className="w-chips" aria-label="Jarak dari pusat wilayah">
                  {[
                    [500, '500 m'],
                    [1000, '1 km'],
                    [null, 'Semua'],
                  ].map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={radius === value}
                      className={radius === value ? 'is-active' : ''}
                      onClick={() => setRadius(value as number | null)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <WRow title="Lokasi tinggi air" icon="water" onClick={() => open('water')} />
                <WRow title="Daftar gempa" icon="pin" onClick={() => open('earthquakes')} />
              </>
            ) : null}
            {!id && ['water', 'earthquakes'].includes(panel) && (
              <div className="w-map-tabs">
                <WButton secondary={panel !== 'water'} onClick={() => open('water')}>
                  Tinggi air
                </WButton>
                <WButton secondary={panel !== 'earthquakes'} onClick={() => open('earthquakes')}>
                  Gempa
                </WButton>
              </div>
            )}
            {feed.isError && ['water', 'earthquakes'].includes(panel) && (
              <>
                <WError>Data pengamatan belum dapat dimuat.</WError>
                <WButton secondary onClick={() => void feed.refetch()}>
                  Coba lagi
                </WButton>
              </>
            )}
            {feed.isPending && ['water', 'earthquakes'].includes(panel) && (
              <p role="status">Memuat pengamatan…</p>
            )}
            {water ? (
              <WaterDetail water={water} />
            ) : quake ? (
              <EarthquakeDetail quake={quake} />
            ) : place ? (
              <>
                <h2>{place.name}</h2>
                <p>{place.description}</p>
                {place.accessibility && <p className="w-muted">{place.accessibility}</p>}
                <a
                  className="w-button w-secondary"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka petunjuk arah
                  <WIcon name="arrow" size={20} />
                </a>
              </>
            ) : null}
            {panel === 'report' && publicReport && (
              <div className="w-observation">
                <h2>{publicReport.summary}</h2>
                <small>Ditinjau Posko · {observationTime(publicReport.reviewedAt)}</small>
              </div>
            )}
            {!id &&
              (panel === 'water' || panel === 'search') &&
              waters.map((x) => (
                <WRow
                  key={x.id}
                  title={x.name}
                  subtitle={`${x.heightCm} cm · ${statusNames[waterDisplayStatus(x)]} · ${observationTime(x.updatedAt)}`}
                  icon="water"
                  onClick={() => open('water', x.id)}
                />
              ))}
            {!id &&
              (panel === 'earthquakes' || panel === 'search') &&
              quakes.map((x) => (
                <WRow
                  key={x.id}
                  title={`M ${x.magnitude} · ${x.region}`}
                  subtitle={`${x.depthKm} km · ${observationTime(x.occurredAt)}`}
                  icon="pin"
                  onClick={() => open('earthquakes', x.id)}
                />
              ))}
            {panel === 'search' &&
              places.map((x) => (
                <WRow
                  key={x.id}
                  title={x.name}
                  subtitle={x.description}
                  icon="building"
                  onClick={() => open('place', x.id)}
                />
              ))}
            {panel === 'search' &&
              publicReports.map((report) => (
                <WRow
                  key={report.id}
                  title={report.summary}
                  subtitle={`Ditinjau Posko · ${observationTime(report.reviewedAt)}`}
                  icon="report"
                  onClick={() => open('report', report.id)}
                />
              ))}
            {!id &&
              !feed.isPending &&
              !feed.isError &&
              ((panel === 'water' && !waters.length) ||
                (panel === 'earthquakes' && !quakes.length) ||
                (panel === 'search' &&
                  !waters.length &&
                  !quakes.length &&
                  !places.length &&
                  !publicReports.length)) && (
                <WEmpty title={panel === 'search' ? 'Tidak ada hasil' : 'Belum ada data'} />
              )}
          </div>
          {panel === 'filters' && (
            <Link to="/report" className="w-button w-panel-bottom">
              Buat laporan
            </Link>
          )}
        </aside>
      )}
    </div>
  );
}
