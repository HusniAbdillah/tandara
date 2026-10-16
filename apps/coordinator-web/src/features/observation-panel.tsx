import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@tandara/api-client';
import { observationsSchema } from '@tandara/contracts';
import type { WaterObservation } from '@tandara/contracts';
import type { Map, Marker } from 'maplibre-gl';
import { Button, formatTime } from '@tandara/ui';
import './observation-panel.css';

const labels = {
  normal: 'Normal',
  waspada: 'Waspada',
  siaga: 'Siaga',
  bahaya: 'Bahaya',
  unknown: 'Belum diketahui',
};
const colors = {
  normal: '#2f7e50',
  waspada: '#e3a33b',
  siaga: '#a94d08',
  bahaya: '#bc4938',
  unknown: '#6b7280',
};
const status = (water: WaterObservation) =>
  water.thresholds.length === 4 ? water.status : 'unknown';
export function ObservationPanel({
  regionId,
  mapRef,
  ready,
}: {
  regionId: string;
  mapRef: RefObject<Map | null>;
  ready: boolean;
}) {
  const [waterVisible, setWaterVisible] = useState(true),
    [quakeVisible, setQuakeVisible] = useState(true);
  const [tab, setTab] = useState<'water' | 'earthquakes'>('water');
  const [selected, setSelected] = useState<{ type: 'water' | 'earthquakes'; id: string } | null>(
    null,
  );
  const feed = useQuery({
    queryKey: ['map-observations', regionId],
    queryFn: ({ signal }) =>
      request('/regions/' + regionId + '/observations', observationsSchema, { signal }),
    refetchInterval: 60000,
  });
  const water =
    selected?.type === 'water' ? feed.data?.water.find((x) => x.id === selected.id) : undefined;
  const quake =
    selected?.type === 'earthquakes'
      ? feed.data?.earthquakes.find((x) => x.id === selected.id)
      : undefined;
  function select(type: 'water' | 'earthquakes', id: string) {
    setSelected({ type, id });
    setTab(type);
    const point =
      type === 'water'
        ? feed.data?.water.find((x) => x.id === id)?.location
        : feed.data?.earthquakes.find((x) => x.id === id)?.location;
    if (point)
      mapRef.current?.flyTo({
        center: [point.longitude, point.latitude],
        zoom: type === 'water' ? 14 : 9,
        essential: false,
      });
  }
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !feed.data) return;
    let disposed = false;
    const markers: Marker[] = [];
    void import('maplibre-gl')
      .then((lib) => {
        if (disposed) return;
        const pins = [
          ...(waterVisible
            ? feed.data!.water.map((x) => ({
                id: x.id,
                type: 'water' as const,
                location: x.location,
                label: x.heightCm + ' cm',
                name: x.name,
                color: colors[status(x)],
              }))
            : []),
          ...(quakeVisible
            ? feed.data!.earthquakes.map((x) => ({
                id: x.id,
                type: 'earthquakes' as const,
                location: x.location,
                label: 'M ' + x.magnitude,
                name: x.region,
                color: '#1f6f7a',
              }))
            : []),
        ];
        for (const pin of pins) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'posko-observation-marker is-' + pin.type;
          button.textContent = pin.label;
          button.style.backgroundColor = pin.color;
          button.style.color = pin.color === colors.waspada ? '#10303d' : 'white';
          button.setAttribute('aria-label', pin.name + ' · ' + pin.label);
          button.addEventListener('click', () => {
            setSelected({ type: pin.type, id: pin.id });
            setTab(pin.type);
            map.flyTo({
              center: [pin.location.longitude, pin.location.latitude],
              zoom: pin.type === 'water' ? 14 : 9,
              essential: false,
            });
          });
          markers.push(
            new lib.Marker({ element: button })
              .setLngLat([pin.location.longitude, pin.location.latitude])
              .addTo(map),
          );
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      markers.forEach((marker) => marker.remove());
    };
  }, [feed.data, mapRef, ready, waterVisible, quakeVisible]);
  return (
    <section className="panel posko-observations" aria-label="Pengamatan tinggi air dan gempa">
      <div className="posko-observation-heading">
        <h2>Tinggi air dan gempa</h2>
        <Button variant="outline" onClick={() => void feed.refetch()}>
          Perbarui pengamatan
        </Button>
      </div>
      <div className="layer-controls">
        <label>
          <input
            type="checkbox"
            checked={waterVisible}
            onChange={(e) => setWaterVisible(e.target.checked)}
          />
          Tinggi air
        </label>
        <label>
          <input
            type="checkbox"
            checked={quakeVisible}
            onChange={(e) => setQuakeVisible(e.target.checked)}
          />
          Gempa
        </label>
      </div>
      <div className="posko-observation-sources">
        {feed.data?.sources.map((s) => (
          <span key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
            {s.status !== 'ready'
              ? ' · ' +
                (s.status === 'stale' ? 'Menampilkan data terakhir' : 'Sumber belum dapat diakses')
              : ''}
          </span>
        ))}
      </div>
      {feed.isPending && <p role="status">Memuat pengamatan…</p>}
      {feed.isError && <p role="alert">Data pengamatan belum dapat dimuat.</p>}
      <div className="posko-observation-tabs">
        <Button
          variant={tab === 'water' ? 'default' : 'outline'}
          onClick={() => {
            setTab('water');
            setSelected(null);
          }}
        >
          Lokasi tinggi air ({feed.data?.water.length ?? 0})
        </Button>
        <Button
          variant={tab === 'earthquakes' ? 'default' : 'outline'}
          onClick={() => {
            setTab('earthquakes');
            setSelected(null);
          }}
        >
          Gempa ({feed.data?.earthquakes.length ?? 0})
        </Button>
      </div>
      <div className="posko-observation-grid">
        <div className="posko-observation-list">
          {tab === 'water'
            ? feed.data?.water.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={selected?.id === x.id}
                  onClick={() => select('water', x.id)}
                >
                  <strong>{x.name}</strong>
                  <span>
                    {x.heightCm} cm · {labels[status(x)]}
                  </span>
                  <small>{formatTime(x.updatedAt)}</small>
                </button>
              ))
            : feed.data?.earthquakes.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={selected?.id === x.id}
                  onClick={() => select('earthquakes', x.id)}
                >
                  <strong>
                    M {x.magnitude} · {x.region}
                  </strong>
                  <span>
                    {x.depthKm} km · {formatTime(x.occurredAt)}
                  </span>
                </button>
              ))}
          {feed.data && !feed.data[tab].length && <p>Belum ada data pengamatan.</p>}
        </div>
        <div className="posko-observation-detail" aria-label="Detail pengamatan">
          {water ? (
            <>
              <h3>{water.name}</h3>
              <p>
                <strong>{water.heightCm} cm</strong> ·{' '}
                <span style={{ color: colors[status(water)] }}>{labels[status(water)]}</span>
              </p>
              <p>Diperbarui {formatTime(water.updatedAt)}</p>
              <h4>Batas ketinggian</h4>
              {water.thresholds.length ? (
                <dl>
                  {water.thresholds.map((t) => (
                    <div key={t.status}>
                      <dt>{labels[t.status]}</dt>
                      <dd>{t.label}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>Belum tersedia</p>
              )}
            </>
          ) : quake ? (
            <>
              <h3>Gempa M {quake.magnitude}</h3>
              <p>{formatTime(quake.occurredAt)}</p>
              <dl>
                <div>
                  <dt>Kedalaman</dt>
                  <dd>{quake.depthKm} km</dd>
                </div>
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
            </>
          ) : (
            <p>Pilih lokasi atau gempa untuk melihat detail.</p>
          )}
        </div>
      </div>
    </section>
  );
}
