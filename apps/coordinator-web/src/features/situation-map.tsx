import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@tandara/api-client';
import { coverageSchema, publicDataSchema, reportPageSchema } from '@tandara/contracts';
import type { Region, User } from '@tandara/contracts';
import { Badge, Notice, PageHeader, formatTime } from '@tandara/ui';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { categories, statuses } from './reports-ui.js';

export function SituationMap({ region, user }: { region: Region; user: User }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({
    reports: true,
    plans: true,
    coverage: true,
    sources: true,
  });
  const coverage = useQuery({
    queryKey: ['coverage', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/coverage', coverageSchema),
  });
  const reports = useQuery({
    queryKey: ['map-reports', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/reports', reportPageSchema),
  });
  const publicData = useQuery({
    queryKey: ['map-public', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/public', publicDataSchema),
  });
  useEffect(() => {
    if (!element.current || !coverage.data || !reports.data || !publicData.data) return;
    let disposed = false;
    let map: Map | undefined;
    void import('maplibre-gl')
      .then((lib) => {
        if (disposed || !element.current) return;
        try {
          lib.setWorkerUrl(workerUrl);
          const ring = region.boundary.coordinates[0]!;
          const xs = ring.map((p) => p[0]!);
          const ys = ring.map((p) => p[1]!);
          const config = import.meta.env['VITE_MAP_STYLE_URL'] as string | undefined;
          map = new lib.Map({
            container: element.current,
            style: config ?? {
              version: 8,
              sources: {},
              layers: [
                { id: 'background', type: 'background', paint: { 'background-color': '#ecf0e6' } },
              ],
            },
            center: [
              (Math.min(...xs) + Math.max(...xs)) / 2,
              (Math.min(...ys) + Math.max(...ys)) / 2,
            ],
            zoom: 13,
            attributionControl: { compact: true },
            canvasContextAttributes: { preserveDrawingBuffer: true },
          });
          mapRef.current = map;
          setReady(false);
          map.on('error', () => {
            if (!disposed) setFailed(true);
          });
          map.addControl(new lib.NavigationControl(), 'top-right');
          map.on('load', () => {
            if (!map) return;
            map.addSource('boundary', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: region.boundary.coordinates },
              },
            });
            map.addLayer({
              id: 'boundary-line',
              type: 'line',
              source: 'boundary',
              paint: { 'line-color': '#4d7661', 'line-width': 2, 'line-dasharray': [3, 2] },
            });
            map.addSource('coverage', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: coverage.data!.cells.map((c) => ({
                  type: 'Feature' as const,
                  geometry: { type: 'Polygon' as const, coordinates: c.geometry.coordinates },
                  properties: { state: c.state },
                })),
              },
            });
            map.addLayer({
              id: 'coverage-fill',
              type: 'fill',
              source: 'coverage',
              paint: {
                'fill-color': [
                  'case',
                  ['==', ['get', 'state'], 'insufficient_information'],
                  '#cfb877',
                  '#c4d9c3',
                ],
                'fill-opacity': 0.35,
                'fill-outline-color': '#b6bea9',
              },
            });
            map.addSource('reports', {
              type: 'geojson',
              cluster: true,
              clusterRadius: 40,
              data: {
                type: 'FeatureCollection',
                features: reports
                  .data!.items.filter((r) => r.latitude !== null && r.longitude !== null)
                  .map((r) => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [r.longitude!, r.latitude!] },
                    properties: {
                      id: r.id,
                      title: categories[r.category],
                      state: statuses[r.state],
                      observedAt: formatTime(r.observationTime),
                      source: 'Laporan warga · simulasi',
                    },
                  })),
              },
            });
            map.addLayer({
              id: 'reports-circle',
              type: 'circle',
              source: 'reports',
              paint: {
                'circle-radius': ['case', ['has', 'point_count'], 14, 7],
                'circle-color': '#b6652c',
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 2,
              },
            });
            map.on('click', 'reports-circle', (e) => {
              const feature = e.features?.[0];
              if (!feature || !map) return;
              if (feature.properties?.['cluster']) {
                void (map.getSource('reports') as GeoJSONSource)
                  .getClusterExpansionZoom(Number(feature.properties['cluster_id']))
                  .then((zoom) => {
                    if (map) map.easeTo({ center: e.lngLat, zoom });
                  });
                return;
              }
              const node = document.createElement('div');
              node.className = 'map-popup';
              node.textContent =
                String(feature.properties?.['title']) +
                ' — ' +
                String(feature.properties?.['state']) +
                '. ' +
                String(feature.properties?.['source']) +
                '. Pengamatan: ' +
                String(feature.properties?.['observedAt']);
              new lib.Popup().setLngLat(e.lngLat).setDOMContent(node).addTo(map);
            });
            map.addSource('plans', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: publicData.data!.plans.flatMap((p) =>
                  p.content.points.map((point) => ({
                    type: 'Feature' as const,
                    geometry: {
                      type: 'Point' as const,
                      coordinates: [point.longitude, point.latitude],
                    },
                    properties: {
                      name: point.name,
                      source: p.owner,
                      reviewedAt: formatTime(p.reviewedAt),
                    },
                  })),
                ),
              },
            });
            map.addLayer({
              id: 'plans-circle',
              type: 'circle',
              source: 'plans',
              paint: {
                'circle-color': '#126653',
                'circle-radius': 9,
                'circle-stroke-color': 'white',
                'circle-stroke-width': 2,
              },
            });
            map.on('click', 'plans-circle', (e) => {
              if (!map) return;
              const node = document.createElement('div');
              node.className = 'map-popup';
              node.textContent =
                String(e.features?.[0]?.properties?.['name']) +
                ' · titik simulasi · ' +
                String(e.features?.[0]?.properties?.['source']) +
                ' · tinjauan ' +
                String(e.features?.[0]?.properties?.['reviewedAt']);
              new lib.Popup().setLngLat(e.lngLat).setDOMContent(node).addTo(map);
            });
            map.addLayer({
              id: 'sources-fill',
              type: 'line',
              source: 'boundary',
              paint: {
                'line-color': '#457c9b',
                'line-width': 4,
                'line-opacity': publicData.data!.information.some((i) => !i.simulation) ? 0.6 : 0,
              },
            });
            map.fitBounds(
              [
                [Math.min(...xs), Math.min(...ys)],
                [Math.max(...xs), Math.max(...ys)],
              ],
              { padding: 40, duration: 0 },
            );
            map.once('idle', () => {
              if (!disposed) {
                setReady(true);
                element.current?.setAttribute('data-map-ready', 'true');
              }
            });
            for (const [key, id] of Object.entries({
              reports: 'reports-circle',
              plans: 'plans-circle',
              coverage: 'coverage-fill',
              sources: 'sources-fill',
            }))
              map.setLayoutProperty(
                id,
                'visibility',
                layers[key as keyof typeof layers] ? 'visible' : 'none',
              );
          });
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
    };
    // Layer visibility is changed separately without rebuilding the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, coverage.data, reports.data, publicData.data]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    for (const [key, id] of Object.entries({
      reports: 'reports-circle',
      plans: 'plans-circle',
      coverage: 'coverage-fill',
      sources: 'sources-fill',
    }))
      if (map.getLayer(id))
        map.setLayoutProperty(
          id,
          'visibility',
          layers[key as keyof typeof layers] ? 'visible' : 'none',
        );
  }, [layers]);
  return (
    <>
      <PageHeader
        eyebrow="Peta situasi / kualitas informasi"
        title="Lihat konteks. Periksa yang belum diketahui."
        description="Lapisan dipisahkan menurut sumber. Peta dasar tidak menunjukkan jalur aman atau kondisi banjir."
      />
      <div className="layer-controls">
        {Object.entries({
          reports: 'Laporan warga',
          plans: 'Titik rencana',
          coverage: 'Cakupan informasi',
          sources: 'Sumber eksternal',
        }).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layers[key as keyof typeof layers]}
              onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      {!ready && !failed && <p role="status">Memuat lapisan peta…</p>}
      <div
        className="map-panel"
        ref={element}
        role="region"
        aria-label="Peta situasi; alternatif teks tersedia di bawah"
      >
        {failed && (
          <div className="map-fallback">
            Peta WebGL tidak tersedia. Gunakan ringkasan wilayah dan lokasi di bawah.
          </div>
        )}
      </div>
      <div className="legend">
        <span>
          <i />
          Laporan warga
        </span>
        <span className="teal">
          <i />
          Titik rencana lokal
        </span>
        <span className="gap">
          <i />
          Informasi belum cukup
        </span>
        <span>Peta skematis tanpa tile eksternal secara default</span>
      </div>
      {coverage.data ? (
        <>
          <Notice tone="warning">
            Coverage gap berarti informasi belum cukup, bukan wilayah aman.
          </Notice>
          <section className="panel">
            <h2>Cakupan informasi · {coverage.data.hours} jam terakhir</h2>
            <p className="hint">{coverage.data.method}</p>
            <div className="metrics">
              {coverage.data.cells.map((c) => (
                <div className="metric" key={c.id}>
                  <h2>Bagian {c.id}</h2>
                  <span className="number">{c.count}</span>
                  <Badge tone={c.count ? 'teal' : 'amber'}>
                    {c.count ? 'Ada pengamatan' : 'Informasi belum cukup'}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="meta">
              Dihitung {formatTime(coverage.data.generatedAt)}. Tampilan peta memuat 20 laporan
              terbaru; cakupan dihitung dari seluruh laporan dalam jendela waktu.
            </p>
            <h3>Alternatif teks lokasi</h3>
            <ul>
              {reports.data?.items.map((r) => (
                <li key={r.id}>
                  {r.landmarkText || 'Lokasi tidak diketahui'} · {categories[r.category]} ·{' '}
                  {statuses[r.state]} · pengamatan {formatTime(r.observationTime)}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <Notice tone={coverage.isError ? 'error' : 'info'}>
          {coverage.isError ? 'Cakupan tidak dapat dimuat.' : 'Menghitung cakupan…'}
        </Notice>
      )}
    </>
  );
}
