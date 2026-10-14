import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { deploymentSchema, publicDataSchema, regionSchema, planSchema } from '@tandara/contracts';
import type { PublicData, Region, Plan } from '@tandara/contracts';
import { Badge, Brand, Empty, Icon, Notice, PageHeader, formatTime, useClock } from '@tandara/ui';
import { residentDb } from '../offline/database.js';
import { synchronize } from '../offline/sync.js';
import { ReportForm, TrackingPage, TrainingPage } from './resident-workflows.js';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
const nav = [
  ['/', 'Beranda', 'home'],
  ['/plan', 'Rencana', 'plan'],
  ['/report', 'Laporan', 'report'],
  ['/checklist', 'Checklist', 'check'],
  ['/training', 'Latihan', 'training'],
] as const;
export function ResidentApp() {
  const deployment = useQuery({
    queryKey: ['deployment'],
    queryFn: () => request('/deployment', deploymentSchema),
  });
  const path = useLocation().pathname;
  const online = useOnline();
  const [regionId, setRegionId] = useState(localStorage.getItem('tandara:region') ?? '');
  const [large, setLarge] = useState(localStorage.getItem('tandara:large') === 'true');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const handler = (e: Event) => setUpdate(() => (e as CustomEvent<() => Promise<void>>).detail);
    window.addEventListener('tandara:update-available', handler);
    return () => window.removeEventListener('tandara:update-available', handler);
  }, []);
  const [saveMessage, setSaveMessage] = useState('');
  const regions = useQuery({
    queryKey: ['regions', online],
    queryFn: async () => {
      try {
        const result = await request('/regions', z.array(regionSchema));
        localStorage.setItem('tandara:regions', JSON.stringify(result));
        return result;
      } catch (error) {
        const cached = localStorage.getItem('tandara:regions');
        if (cached) return z.array(regionSchema).parse(JSON.parse(cached));
        throw error;
      }
    },
  });
  const activeRegion = regionId || regions.data?.[0]?.id || '';
  const data = useQuery({
    queryKey: ['public', activeRegion, online],
    enabled: !!activeRegion,
    queryFn: async (): Promise<PublicData> => {
      const saved = (await residentDb.plans.where('regionId').equals(activeRegion).toArray()).sort(
        (a, b) => b.cachedAt.localeCompare(a.cachedAt),
      )[0];
      setSavedAt(saved?.cachedAt ?? null);
      try {
        if (!navigator.onLine) throw new Error('Offline');
        const fresh = await request('/regions/' + activeRegion + '/public', publicDataSchema);
        setCached(false);
        return fresh;
      } catch (error) {
        const region = regions.data?.find((r) => r.id === activeRegion);
        if (saved && region) {
          setCached(true);
          return {
            region,
            plans: [planSchema.parse(saved.content)],
            information: [],
            reports: [],
            sources: [],
            fetchedAt: saved.cachedAt,
          };
        }
        throw error;
      }
    },
    retry: 1,
    refetchInterval: online ? 60000 : false,
  });
  useEffect(() => {
    void synchronize().catch(() => {});
    const sync = () => {
      void synchronize().catch(() => {});
    };
    window.addEventListener('online', sync);
    const timer = setInterval(sync, 30000);
    return () => {
      window.removeEventListener('online', sync);
      clearInterval(timer);
    };
  }, []);
  function choose(id: string) {
    localStorage.setItem('tandara:region', id);
    setRegionId(id);
    setSaveMessage('');
  }
  async function save(plan: Plan) {
    try {
      await residentDb.transaction('rw', residentDb.plans, async () => {
        await residentDb.plans.where('regionId').equals(plan.regionId).delete();
        await residentDb.plans.put({
          versionId: plan.id,
          regionId: plan.regionId,
          cachedAt: new Date().toISOString(),
          content: plan,
        });
      });
      setSavedAt(new Date().toISOString());
      setSaveMessage('Rencana tersimpan di perangkat. Dapat dibaca saat offline.');
    } catch {
      setSaveMessage('Penyimpanan perangkat penuh atau tidak tersedia. Rencana belum tersimpan.');
    }
  }
  const region = data.data?.region ?? regions.data?.find((r) => r.id === activeRegion);
  const plan = data.data?.plans[0];
  let content;
  if (path === '/report')
    content = region ? (
      <ReportForm key={activeRegion} region={region} online={online} />
    ) : (
      <Empty title="Pilih wilayah">Wilayah diperlukan sebelum laporan dapat disimpan.</Empty>
    );
  else if (path === '/tracking') content = <TrackingPage />;
  else if (path === '/training')
    content = region ? <TrainingPage key={activeRegion} region={region} /> : null;
  else if (data.isPending)
    content = (
      <div className="loading" role="status">
        Memuat informasi wilayah…
      </div>
    );
  else if (data.isError)
    content = (
      <>
        <Notice tone="error">
          Informasi wilayah tidak dapat dimuat.{' '}
          {online
            ? 'Coba lagi atau pilih wilayah lain.'
            : 'Simpan rencana saat online agar dapat dibaca di perangkat ini.'}
        </Notice>
        <button onClick={() => void data.refetch()}>Coba lagi</button>
      </>
    );
  else if (path === '/plan')
    content = (
      <>
        <PageHeader
          eyebrow="Rencana lokal"
          title="Langkah yang disepakati bersama."
          description="Baca sumber, tanggal tinjauan, dan masa berlaku sebelum menggunakan rencana."
        />
        {plan ? (
          <PlanView plan={plan} onSave={() => void save(plan)} savedAt={savedAt} />
        ) : (
          <Empty title="Belum ada rencana yang berlaku">
            Rencana belum diterbitkan atau telah kedaluwarsa. Hubungi pengelola lokal.
          </Empty>
        )}
        {saveMessage && <Notice>{saveMessage}</Notice>}
      </>
    );
  else if (path === '/checklist')
    content = plan ? (
      <Checklist key={plan.regionId} plan={plan} />
    ) : (
      <Empty title="Checklist lokal belum tersedia">
        Belum ada rencana yang berlaku di wilayah ini.
      </Empty>
    );
  else if (path === '/help') content = region ? <Help region={region} /> : null;
  else if (path !== '/')
    content = (
      <Empty title="Halaman tidak ditemukan">
        <Link to="/">Kembali ke beranda</Link>
      </Empty>
    );
  else content = data.data ? <Home data={data.data} plan={plan} /> : null;
  return (
    <div className={large ? 'large-text' : ''}>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <header className="citizen-header border-b border-line bg-white print:hidden">
        <div className="mx-auto flex max-w-[1184px] items-center justify-between gap-6 px-8 py-5 min-[1600px]:max-w-[1280px] max-md:px-5 max-md:py-4">
          <Brand audience="Warga" />
          <nav
            className="citizen-nav flex gap-1 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:justify-around max-md:gap-0 max-md:border-t max-md:border-line max-md:bg-white max-md:px-1 max-md:pt-1 max-md:pb-[max(4px,env(safe-area-inset-bottom))] print:hidden"
            aria-label="Navigasi warga"
          >
            {nav.map(([url, label, icon]) => (
              <NavLink
                key={url}
                to={url}
                end={url === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3.5 py-2.5 text-[13px] font-semibold text-muted no-underline max-[1100px]:px-2.5 max-md:min-h-[54px] max-md:flex-1 max-md:flex-col max-md:gap-[3px] max-md:rounded-none max-md:px-0.5 max-md:py-[7px] max-md:text-[10px] ${isActive ? 'bg-soft text-brand max-md:bg-transparent' : ''}`
                }
              >
                <Icon name={icon} className="max-[1100px]:hidden max-md:block max-md:size-[18px]" />
                {label}
              </NavLink>
            ))}
          </nav>
          {region?.simulation && <Badge tone="amber">WILAYAH DEMO</Badge>}
        </div>
      </header>
      <div className="context-bar border-b border-line bg-[#fafbf7] print:hidden">
        <div className="mx-auto flex max-w-[1184px] items-center justify-between gap-4 px-8 py-3 min-[1600px]:max-w-[1280px] max-md:px-5 max-md:py-2.5">
          <label className="flex max-w-[330px] items-center gap-2.5 text-brand">
            <Icon name="pin" />
            <span className="sr-only">Wilayah</span>
            <select
              aria-label="Wilayah"
              value={activeRegion}
              onChange={(e) => choose(e.target.value)}
              className="min-h-8 border-0 bg-transparent px-0 py-1 pr-6 text-[13px] font-semibold"
            >
              {regions.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <span className="flex items-center gap-1.5 text-xs text-muted max-md:text-[10px]">
            <Icon name="wifi" size={14} />
            {online ? 'Terhubung' : 'Offline · data tersimpan'}
          </span>
        </div>
      </div>
      <main
        id="main"
        className="citizen-main mx-auto max-w-[1184px] px-8 pt-9 min-[1600px]:max-w-[1280px] max-md:px-5 max-md:pb-[78px] max-md:pt-6 print:p-0"
        tabIndex={-1}
      >
        {update && (
          <Notice>
            Versi aplikasi baru tersedia. Draf antrean tetap disimpan. Selesaikan formulir yang
            masih terbuka sebelum memperbarui.{' '}
            <button onClick={() => void update()}>Perbarui aplikasi</button>
          </Notice>
        )}
        {(!online || cached) && (
          <Notice tone="warning">
            Menggunakan data tersimpan. Informasi mungkin tidak terbaru. Laporan belum terkirim
            sampai ada konfirmasi server.
          </Notice>
        )}
        {regions.isError && <Notice tone="error">Daftar wilayah tidak tersedia.</Notice>}
        {content}
        <footer className="safe-footer mt-12 border-t border-line py-6 text-xs text-muted print:hidden">
          <div className="actions">
            <Link to="/help">Bantuan & privasi</Link>
            <Link to="/tracking">Laporan saya</Link>
            <button
              className="quiet small"
              aria-pressed={large}
              onClick={() => {
                localStorage.setItem('tandara:large', String(!large));
                setLarge(!large);
              }}
            >
              Ukuran teks {large ? 'standar' : 'besar'}
            </button>
            {deployment.data && <a href={deployment.data.coordinatorOrigin}>Tandara Posko</a>}
          </div>
          <p>
            {region?.simulation
              ? 'Wilayah demo: laporan dan rencana contoh berlabel simulasi. Sumber publik asli berlabel terpisah. '
              : ''}
            Tandara mendukung kesiapsiagaan komunitas; ikuti arahan otoritas resmi.
          </p>
        </footer>
      </main>
    </div>
  );
}
function Home({ data, plan }: { data: PublicData; plan: Plan | undefined }) {
  const now = useClock();
  const [search, setSearch] = useState('');
  return (
    <>
      <div className="intro-strip">
        <div>
          <p className="eyebrow">Kesiapsiagaan komunitas</p>
          <span className="muted">
            {data.region.name} · {data.region.organization}
          </span>
        </div>
        <span className="meta">Halaman dimuat {formatTime(data.fetchedAt)}</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Siap bersama, mulai dari sekitar.</p>
          <h1>
            Kenali wilayah.
            <br />
            Siapkan langkah.
          </h1>
          <p>
            Informasi yang jelas, rencana lokal yang ditinjau, dan ruang untuk saling memberi kabar.
          </p>
          <Link to="/plan" className="button primary">
            Baca rencana lokal <Icon name="arrow" />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 450 320" fill="none">
            <g stroke="#739784" strokeWidth="1" opacity=".55">
              <path d="M-50 260C90 230 60 100 250 120S380 40 490 70M-40 280C120 245 80 130 260 140S385 80 500 90M-20 300C140 260 100 160 280 170S400 100 510 130M-10 200C80 180 60 65 240 90S360 0 460 30M-20 180C100 150 30 45 240 60S350-20 480 0" />
              <path
                d="M40 0v320M100 0v320M160 0v320M220 0v320M280 0v320M340 0v320M400 0v320M0 40h450M0 100h450M0 160h450M0 220h450M0 280h450"
                opacity=".25"
              />
            </g>
            <circle cx="290" cy="95" r="4" fill="#c6d8af" />
            <circle cx="90" cy="225" r="4" fill="#c6d8af" />
          </svg>
          <div className="art-center">
            <Icon name="shield" size={48} />
          </div>
          <span className="art-label">LOCAL SIGNALS / SHARED READINESS</span>
        </div>
      </section>
      <div className="quick-links">
        <Link to="/report" className="quick-link">
          <Icon name="report" />
          <div>
            <h2>Bagikan pengamatan</h2>
            <p>Laporkan kondisi yang Anda lihat.</p>
          </div>
        </Link>
        <Link to="/checklist" className="quick-link">
          <Icon name="check" />
          <div>
            <h2>Siapkan keluarga</h2>
            <p>{plan ? 'Checklist dari rencana lokal.' : 'Rencana lokal belum tersedia.'}</p>
          </div>
        </Link>
        <Link to="/help" className="quick-link">
          <Icon name="help" />
          <div>
            <h2>Akses bantuan</h2>
            <p>Kontak lokal & tindak lanjut komunitas.</p>
          </div>
        </Link>
      </div>
      <div className="wide-split">
        <section className="panel">
          <div className="panel-heading">
            <h2>Informasi wilayah</h2>
            <Badge>SUMBER & WAKTU</Badge>
          </div>
          <label className="field">
            <span className="sr-only">Cari informasi</span>
            <input
              placeholder="Cari informasi wilayah…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {data.information.length ? (
            <ul className="article-list">
              {data.information
                .filter((i) =>
                  (i.title + ' ' + i.body).toLowerCase().includes(search.toLowerCase()),
                )
                .map((i) => (
                  <li key={i.id}>
                    <div className="actions">
                      <Badge tone={i.simulation ? 'amber' : 'teal'}>
                        {i.simulation
                          ? 'SIMULASI'
                          : i.sourceType === 'official_alert'
                            ? 'BMKG · peringatan resmi'
                            : i.sourceType === 'official_weather'
                              ? 'Sumber resmi · prakiraan cuaca'
                              : 'Laporan urun daya eksternal'}
                      </Badge>
                      {i.expiresAt && Date.parse(i.expiresAt) < now && (
                        <Badge tone="amber">Kedaluwarsa</Badge>
                      )}
                    </div>
                    <h3 style={{ marginTop: 12 }}>{i.title}</h3>
                    <p>{i.body}</p>
                    <details>
                      <summary>Sumber dan riwayat waktu</summary>
                      <div className="meta">
                        <a href={i.sourceUrl} target="_blank" rel="noreferrer">
                          {i.sourceName}
                        </a>
                        <span>Diambil {formatTime(i.fetchedAt)}</span>
                        <span>Diterbitkan sumber: {formatTime(i.issuedAt)}</span>
                        <span>Pengamatan: {formatTime(i.observedAt)}</span>
                        <span>Berlaku: {formatTime(i.effectiveAt)}</span>
                        <span>Berakhir: {formatTime(i.expiresAt)}</span>
                        <span>
                          Versi {i.version} · {i.verificationStatus}
                        </span>
                      </div>
                    </details>
                  </li>
                ))}
            </ul>
          ) : (
            <Empty title="Informasi belum tersedia">
              Tidak adanya informasi tidak berarti wilayah aman. Periksa kanal otoritas resmi.
            </Empty>
          )}
        </section>
        <aside className="stack">
          <section className="panel">
            <p className="eyebrow">Rencana komunitas</p>
            <h2>{plan?.content.title ?? 'Belum ada rencana berlaku'}</h2>
            {plan ? (
              <>
                <Badge tone="teal">Ditinjau pengelola · versi {plan.version}</Badge>
                <p className="meta">
                  {plan.owner}
                  <br />
                  Tinjauan {formatTime(plan.reviewedAt)}
                </p>
                <Link to="/plan">Lihat instruksi & titik pertemuan →</Link>
              </>
            ) : (
              <p>Rencana akan tersedia setelah diterbitkan oleh pengelola.</p>
            )}
          </section>
          <section className="panel">
            <p className="eyebrow">Pahami sumbernya</p>
            <h3>Setiap kabar punya status.</h3>
            <p className="muted">
              Laporan warga perlu ditinjau. Saran AI perlu diperiksa. Rencana lokal memiliki pemilik
              dan masa berlaku.
            </p>
            <Link to="/training">Ikuti latihan singkat →</Link>
          </section>
        </aside>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Kabar komunitas yang telah ditinjau</h2>
        {data.reports.length ? (
          <ul className="article-list">
            {data.reports.map((r) => (
              <li key={r.id}>
                <Badge tone="teal">Laporan warga · ditinjau koordinator</Badge>{' '}
                {r.simulation && <Badge tone="amber">Simulasi</Badge>}
                <p>{r.summary}</p>
                <div className="meta">
                  Ditinjau {r.reviewer} · {formatTime(r.reviewedAt)}
                  <span>Pengamatan {formatTime(r.observationTime)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Belum ada kabar yang diterbitkan">
            Laporan mentah dan kebutuhan bantuan pribadi hanya dapat diakses koordinator berwenang.
          </Empty>
        )}
      </section>
    </>
  );
}
export function PlanView({
  plan,
  onSave,
  savedAt,
}: {
  plan: Plan;
  onSave?: () => void;
  savedAt?: string | null;
}) {
  const now = useClock();
  return (
    <>
      <div className="panel">
        <div className="panel-heading">
          <h2>{plan.content.title}</h2>
          {plan.simulation && <Badge tone="amber">Simulasi</Badge>}
        </div>
        <div className="meta">
          <strong>{plan.owner}</strong>
          <span>
            Versi {plan.version} · {plan.state}
          </span>
          <span>
            Ditinjau {plan.reviewer ?? 'Belum ditinjau'} pada {formatTime(plan.reviewedAt)}
          </span>
          <span>Berlaku hingga {formatTime(plan.content.expiresAt)}</span>
        </div>
        {Date.parse(plan.content.expiresAt) < now && (
          <Notice tone="warning">
            Rencana tersimpan ini telah kedaluwarsa. Periksa versi terbaru dan kanal otoritas resmi.
          </Notice>
        )}
        <Notice>
          Rencana lokal bukan perintah evakuasi. Kondisi titik dan akses perlu diperiksa oleh pihak
          berwenang. Tidak ada jaminan rute aman.
        </Notice>
        <h3>Langkah kesiapsiagaan</h3>
        <ol className="rule-list">
          {plan.content.instructions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <h3>Titik pertemuan & fasilitas</h3>
        {plan.content.points.map((p, i) => (
          <div className="point" key={i}>
            <Icon name="pin" />
            <div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <p className="muted">Akses: {p.accessibility || 'Belum diketahui'}</p>
              <small>
                Koordinat referensi {p.latitude}, {p.longitude}
              </small>
            </div>
          </div>
        ))}
        {plan.content.routes.length > 0 && (
          <>
            <h3>Informasi akses yang ditinjau lokal</h3>
            {plan.content.routes.map((r, i) => (
              <div className="point" key={i}>
                <div>
                  <h3>{r.name}</h3>
                  <p>{r.description}</p>
                  <small>{r.reviewNote}</small>
                </div>
              </div>
            ))}
          </>
        )}
        <div className="button-row print:hidden">
          {onSave && (
            <button className="primary" onClick={onSave}>
              <Icon name="download" />
              Simpan offline
            </button>
          )}
          <button onClick={() => window.print()}>Cetak rencana</button>
        </div>
        {savedAt && (
          <p className="meta">
            Disimpan di perangkat {formatTime(savedAt)} · Informasi tersimpan mungkin tidak terbaru.
          </p>
        )}
      </div>
    </>
  );
}
function Checklist({ plan }: { plan: Plan }) {
  const key = 'tandara:checklist:' + plan.regionId;
  const [checks, setChecks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const count = plan.content.checklist.filter((x) => checks.includes(x)).length;
  function toggle(s: string) {
    const next = checks.includes(s) ? checks.filter((x) => x !== s) : [...checks, s];
    localStorage.setItem(key, JSON.stringify(next));
    setChecks(next);
  }
  return (
    <div className="narrow">
      <PageHeader
        eyebrow="Kesiapsiagaan rumah tangga"
        title="Sedikit demi sedikit, lebih siap."
        description="Checklist membantu Anda menyiapkan kebutuhan bersama keluarga. Progres hanya disimpan di perangkat ini."
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Persiapan keluarga</h2>
          <Badge tone="teal">
            {count} / {plan.content.checklist.length}
          </Badge>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Progres checklist"
          aria-valuemin={0}
          aria-valuemax={plan.content.checklist.length}
          aria-valuenow={count}
        >
          <span style={{ width: (count / plan.content.checklist.length) * 100 + '%' }} />
        </div>
        {plan.content.checklist.map((s) => (
          <label key={s} className={'checklist-item ' + (checks.includes(s) ? 'checked' : '')}>
            <input type="checkbox" checked={checks.includes(s)} onChange={() => toggle(s)} />
            <span>{s}</span>
          </label>
        ))}
        <p className="meta">
          Sumber: {plan.owner} · rencana versi {plan.version}
        </p>
      </section>
    </div>
  );
}
function Help({ region }: { region: Region }) {
  const [message, setMessage] = useState('');
  return (
    <div className="narrow">
      <PageHeader eyebrow="Bantuan & privasi" title="Temukan kanal yang tepat." />
      <Notice tone="warning">
        Permintaan di Tandara tidak menjamin bantuan diterima layanan darurat atau petugas dikirim.
        Ikuti kanal resmi setempat.
      </Notice>
      <section className="panel">
        <h2>Kontak wilayah</h2>
        {region.config.contacts.length ? (
          region.config.contacts.map((c) => (
            <div className="point" key={c.name}>
              <div>
                <h3>{c.name}</h3>
                <p>{c.channel}</p>
                <a href={c.sourceUrl}>Sumber kontak</a>
                <p className="meta">Ditinjau {formatTime(c.reviewedAt)}</p>
              </div>
            </div>
          ))
        ) : (
          <Empty title="Kontak resmi terverifikasi belum tersedia">
            Periksa nomor kontak melalui kanal resmi pemerintah daerah dan pengelola komunitas.
          </Empty>
        )}
        <div className="button-row">
          <Link to="/report?help=1" className="button primary">
            Minta tindak lanjut komunitas
          </Link>
          <Link to="/tracking" className="button">
            Status laporan saya
          </Link>
        </div>
      </section>
      <section className="panel">
        <h2>Data Anda</h2>
        <p>
          Laporan mentah, foto, lokasi, dan kontak hanya dapat dilihat pengelola berwenang di
          wilayah laporan. Ringkasan publik diterbitkan terpisah setelah tinjauan manusia. Kontak
          dihapus setelah {region.config.retentionDays} hari.
        </p>
        <p>
          Draf offline tersimpan hingga 7 hari. Hindari menyertakan nama, kontak, atau informasi
          sensitif di perangkat bersama. Token tanda terima memberikan akses status dan permintaan
          penghapusan; jangan bagikan.
        </p>
        <button
          className="danger"
          onClick={async () => {
            await residentDb.transaction(
              'rw',
              residentDb.plans,
              residentDb.drafts,
              residentDb.receipts,
              async () => {
                await residentDb.plans.clear();
                await residentDb.drafts.clear();
                await residentDb.receipts.clear();
              },
            );
            setMessage(
              'Rencana, draf, dan tanda terima di perangkat telah dihapus. Laporan server tetap ada; ajukan penghapusan sebelum menghapus token.',
            );
          }}
        >
          Hapus data tersimpan di perangkat
        </button>
        {message && <Notice>{message}</Notice>}
      </section>
    </div>
  );
}
