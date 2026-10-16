import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  aiRunSchema,
  coverageSchema,
  publicDataSchema,
  reportPageSchema,
} from '@tandara/contracts';
import type { Region, User } from '@tandara/contracts';
import { Badge, Notice, PageHeader, formatTime } from '@tandara/ui';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { categories, statuses } from './reports-ui.js';
import { basemapStyle, loadBasemap } from './basemap.js';

export function SituationMap({ region, user }: { region: Region; user: User }) {
  const queryClient = useQueryClient();
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [basemapLoaded, setBasemapLoaded] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [layers, setLayers] = useState({
    basemap: true,
    reports: true,
    plans: true,
    coverage: true,
    sources: true,
  });
  const basemap = useQuery({
    queryKey: ['basemap-config'],
    queryFn: loadBasemap,
    retry: false,
    staleTime: 60000,
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
  const aiRuns = useQuery({
    queryKey: ['map-ai-coverage', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/ai/runs', z.array(aiRunSchema)),
  });
  const latestCoverageAi = aiRuns.data?.find((r) => r.task === 'coverage' && r.output);
  async function triggerCoverageAi() {
    setAiBusy(true);
    try {
      await request('/regions/' + region.id + '/ai/runs', z.object({ id: z.uuid() }), {
        method: 'POST',
        body: {
          task: 'coverage',
          question:
            'Jelaskan sektor grid cakupan mana yang memiliki pengamatan laporan warga dan sektor mana yang masih titik buta informasi.',
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['map-ai-coverage'] });
      await aiRuns.refetch();
    } finally {
      setAiBusy(false);
    }
  }
  useEffect(() => {
    if (
      !element.current ||
      !coverage.data ||
      !reports.data ||
      !publicData.data ||
      basemap.isPending
    )
      return;
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
          map = new lib.Map({
            container: element.current,
            style: basemapStyle(basemap.data),
            center: [
              (Math.min(...xs) + Math.max(...xs)) / 2,
              (Math.min(...ys) + Math.max(...ys)) / 2,
            ],
            zoom: 13,
            maxZoom: basemap.data?.maxZoom ?? 19,
            renderWorldCopies: false,
            attributionControl: { compact: false },
            canvasContextAttributes: { preserveDrawingBuffer: true },
          });
          mapRef.current = map;
          setReady(false);
          setFailed(false);
          setBasemapFailed(false);
          setBasemapLoaded(false);
          element.current.removeAttribute('data-map-ready');
          map.on('error', (event) => {
            if (disposed) return;
            if ('sourceId' in event && event.sourceId === 'basemap') setBasemapFailed(true);
            else setFailed(true);
          });
          map.on('sourcedata', (event) => {
            if (!disposed && event.sourceId === 'basemap' && event.sourceDataType === 'content')
              setBasemapLoaded(true);
          });
          map.addControl(new lib.NavigationControl(), 'top-right');
          map.addControl(new lib.ScaleControl({ unit: 'metric' }), 'bottom-left');
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
                'fill-opacity': 0.18,
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
              basemap: 'basemap-raster',
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
  }, [region, coverage.data, reports.data, publicData.data, basemap.data, basemap.isPending]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    for (const [key, id] of Object.entries({
      basemap: 'basemap-raster',
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
          basemap: 'Peta dasar',
          reports: 'Laporan warga',
          plans: 'Titik rencana',
          coverage: 'Cakupan informasi',
          sources: 'Sumber eksternal',
        }).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layers[key as keyof typeof layers]}
              disabled={key === 'basemap' && !basemap.data?.enabled}
              onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      {(basemapFailed || basemap.isError) && (
        <Notice tone="warning">
          Peta dasar tidak dapat dimuat. Batas wilayah dan lapisan lokal tetap tersedia; gunakan
          alternatif teks di bawah atau muat ulang setelah koneksi pulih.
        </Notice>
      )}
      {!ready && !failed && <p role="status">Memuat lapisan peta…</p>}
      <div
        className="map-panel"
        ref={element}
        role="region"
        aria-label="Peta situasi; alternatif teks tersedia di bawah"
        data-basemap-status={
          basemapFailed || basemap.isError
            ? 'unavailable'
            : !basemap.data?.enabled
              ? 'disabled'
              : basemapLoaded
                ? 'ready'
                : 'loading'
        }
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
        <span>
          {basemap.data?.enabled
            ? `${basemap.data.label} · memerlukan internet`
            : 'Peta dasar dinonaktifkan'}
        </span>
      </div>
      <p className="hint">
        Tile peta diminta langsung ke penyedia sesuai tampilan wilayah. Teks laporan, kontak dan
        token akses tidak dikirim ke penyedia. Peta jalan bukan panduan jalur aman.
      </p>
      {coverage.data ? (
        <>
          <Notice tone="warning">
            Coverage gap berarti informasi belum cukup, bukan wilayah aman.
          </Notice>
          <section className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2>Cakupan informasi · {coverage.data.hours} jam terakhir</h2>
              <button
                type="button"
                className="small"
                disabled={aiBusy}
                onClick={() => void triggerCoverageAi()}
              >
                Analisis Kesenjangan Cakupan dengan AI
              </button>
            </div>
            <p className="hint">{coverage.data.method}</p>
            {latestCoverageAi?.output && (
              <div className="mb-4 rounded-lg border border-[#cfe0d9] bg-[#f7faf8] p-4">
                <strong className="text-sm text-ink">
                  Penjelasan Titik Buta & Cakupan AI (
                  {String(latestCoverageAi.provenance['provider'] ?? 'deterministik')})
                </strong>
                <p className="mt-1 mb-2 whitespace-pre-line text-sm text-ink">
                  {latestCoverageAi.output.title}
                </p>
                {latestCoverageAi.output.claims.length > 0 && (
                  <ul className="m-0 space-y-1 pl-5 text-sm text-ink">
                    {latestCoverageAi.output.claims.map((c, idx) => (
                      <li key={idx}>{c.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
