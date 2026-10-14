import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  assistanceSchema,
  auditSchema,
  planSchema,
  planContentSchema,
  sourceSchema,
  trainingSchema,
} from '@tandara/contracts';
import type { Plan, PlanContent, Source, Training } from '@tandara/contracts';
import { Badge, Empty, Field, Notice, PageHeader, formatTime } from '@tandara/ui';
import type { ManagementProps } from './posko-app.js';
import { ok } from './reports-ui.js';

export function PlansPage({ region, user, run }: ManagementProps) {
  const query = useQuery({
    queryKey: ['plans', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/plans', z.array(planSchema)),
  });
  const [editing, setEditing] = useState<Plan | null | undefined>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function transition(p: Plan, state: string) {
    setBusy(true);
    setError('');
    try {
      await run(() =>
        request('/regions/' + region.id + '/plans/' + p.id + '/transition', ok, {
          method: 'POST',
          body: { state, reason },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan gagal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Rencana lokal / versi & tinjauan"
        title="Rencana yang punya pemilik."
        description="Draf disimpan terpisah. Peninjau harus berbeda dari penulis. Versi terbit tetap berlaku hingga digantikan atau diarsipkan."
        action={
          <button className="primary" onClick={() => setEditing(null)}>
            Buat draf baru
          </button>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {editing !== undefined ? (
        <PlanEditor
          key={editing?.id ?? region.id}
          plan={editing ?? undefined}
          regionId={region.id}
          onClose={() => setEditing(undefined)}
          run={run}
        />
      ) : (
        <>
          <label className="field">
            <span>Alasan tindakan rencana</span>
            <input
              value={reason}
              minLength={5}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Catat hasil tinjauan atau alasan perubahan status…"
            />
          </label>
          {query.isPending ? (
            <div className="loading">Memuat versi rencana…</div>
          ) : query.isError ? (
            <Notice tone="error">Rencana tidak dapat dimuat.</Notice>
          ) : query.data?.length ? (
            query.data.map((p) => (
              <section className="panel" key={p.id}>
                <div className="panel-heading">
                  <h2>{p.content.title}</h2>
                  <Badge tone={p.state === 'published' ? 'teal' : 'amber'}>
                    v{p.version} · {p.state}
                  </Badge>
                </div>
                <p className="meta">
                  {p.owner} · dibuat {formatTime(p.createdAt)} · ditinjau{' '}
                  {p.reviewer ?? 'Belum ditinjau'} · masa berlaku {formatTime(p.content.expiresAt)}
                </p>
                <details>
                  <summary>Instruksi, titik, dan sumber versi ini</summary>
                  <ol className="rule-list">
                    {p.content.instructions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {p.content.points.map((point, i) => (
                    <div className="point" key={i}>
                      <div>
                        <h3>{point.name}</h3>
                        <p>{point.description}</p>
                        <small>
                          {point.accessibility} · {point.latitude}, {point.longitude}
                        </small>
                      </div>
                    </div>
                  ))}
                  {p.content.routes.map((r, i) => (
                    <p key={i}>
                      {r.name}: {r.description} · {r.reviewNote}
                    </p>
                  ))}
                  <p>
                    {p.simulation ? 'Simulasi — ' : ''}Rencana tidak menjamin keamanan rute saat
                    ini.
                  </p>
                </details>
                <div className="button-row print:hidden">
                  {['draft', 'changes_requested'].includes(p.state) && p.authorId === user.id && (
                    <>
                      <button disabled={busy} onClick={() => setEditing(p)}>
                        Edit draf
                      </button>
                      <button
                        disabled={busy || reason.length < 5}
                        onClick={() => void transition(p, 'in_review')}
                      >
                        Minta tinjauan
                      </button>
                    </>
                  )}
                  {p.state === 'in_review' && p.authorId !== user.id && (
                    <>
                      <button
                        disabled={busy || reason.length < 5}
                        onClick={() => void transition(p, 'approved')}
                      >
                        Setujui versi
                      </button>
                      <button
                        disabled={busy || reason.length < 5}
                        onClick={() => void transition(p, 'changes_requested')}
                      >
                        Minta perbaikan
                      </button>
                    </>
                  )}
                  {p.state === 'approved' && (
                    <button
                      className="primary"
                      disabled={busy || reason.length < 5}
                      onClick={() => void transition(p, 'published')}
                    >
                      Terbitkan versi ditinjau
                    </button>
                  )}
                  {p.state !== 'archived' && (
                    <button
                      disabled={busy || reason.length < 5}
                      onClick={() => void transition(p, 'archived')}
                    >
                      Arsipkan versi
                    </button>
                  )}
                  <button onClick={() => window.print()}>Cetak dengan metadata</button>
                </div>
              </section>
            ))
          ) : (
            <Empty title="Belum ada rencana">Buat draf untuk memulai proses tinjauan lokal.</Empty>
          )}
        </>
      )}
    </>
  );
}
function PlanEditor({
  plan,
  regionId,
  onClose,
  run,
}: {
  plan: Plan | undefined;
  regionId: string;
  onClose: () => void;
  run: ManagementProps['run'];
}) {
  const [title, setTitle] = useState(plan?.content.title ?? 'Rencana kesiapsiagaan warga');
  const [instructions, setInstructions] = useState(
    plan?.content.instructions.join('\n') ??
      'Periksa informasi otoritas resmi.\nSiapkan kebutuhan dasar dan dokumen keluarga.',
  );
  const [checklist, setChecklist] = useState(
    plan?.content.checklist.join('\n') ?? 'Simpan dokumen penting\nSepakati kontak keluarga',
  );
  const [points, setPoints] = useState<PlanContent['points']>(plan?.content.points ?? []);
  const [routes, setRoutes] = useState<PlanContent['routes']>(plan?.content.routes ?? []);
  const [expires, setExpires] = useState(() =>
    (plan?.content.expiresAt ?? new Date(Date.now() + 90 * 86400000).toISOString()).slice(0, 10),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const content = planContentSchema.parse({
            title,
            instructions: instructions.split('\n').filter(Boolean),
            checklist: checklist.split('\n').filter(Boolean),
            points,
            routes,
            expiresAt: new Date(expires + 'T23:59:59+07:00').toISOString(),
          });
          await run(() =>
            request(
              '/regions/' + regionId + '/plans' + (plan ? '/' + plan.id : ''),
              plan ? ok : z.object({ id: z.uuid() }),
              {
                method: plan ? 'PUT' : 'POST',
                body: { content, reason, ...(plan ? { updatedAt: plan.updatedAt } : {}) },
              },
            ),
          );
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Draf tidak tersimpan.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{plan ? 'Edit draf v' + plan.version : 'Draf baru'}</h2>
      <Field label="Judul rencana">
        <input
          required
          minLength={5}
          maxLength={150}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field
        label="Instruksi lokal"
        hint="Satu langkah per baris. Hindari klaim jalur aman dan instruksi evakuasi tanpa otoritas."
      >
        <textarea value={instructions} required onChange={(e) => setInstructions(e.target.value)} />
      </Field>
      <Field label="Checklist keluarga" hint="Satu item per baris.">
        <textarea value={checklist} required onChange={(e) => setChecklist(e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="Berlaku hingga">
          <input
            type="date"
            required
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </Field>
        <Field label="Alasan penyusunan / perubahan">
          <input
            value={reason}
            required
            minLength={5}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
      <section className="form-section">
        <h3>Titik pertemuan & fasilitas</h3>
        <p className="hint">
          Titik harus di dalam wilayah. Kondisi akses perlu diperiksa pengelola.
        </p>
        {points.map((point, i) => (
          <fieldset key={i}>
            <legend>Titik {i + 1}</legend>
            {(['name', 'description', 'accessibility', 'latitude', 'longitude'] as const).map(
              (field) => (
                <Field
                  key={field}
                  label={
                    {
                      name: 'Nama titik',
                      description: 'Keterangan lokasi',
                      accessibility: 'Kondisi aksesibilitas',
                      latitude: 'Lintang',
                      longitude: 'Bujur',
                    }[field]
                  }
                >
                  <input
                    required
                    type={field === 'latitude' || field === 'longitude' ? 'number' : 'text'}
                    step="any"
                    value={point[field]}
                    onChange={(e) =>
                      setPoints(
                        points.map((p, n) =>
                          n === i
                            ? {
                                ...p,
                                [field]:
                                  field === 'latitude' || field === 'longitude'
                                    ? Number(e.target.value)
                                    : e.target.value,
                              }
                            : p,
                        ),
                      )
                    }
                  />
                </Field>
              ),
            )}
            <button type="button" onClick={() => setPoints(points.filter((_, n) => n !== i))}>
              Hapus titik {i + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            setPoints([
              ...points,
              { name: '', description: '', accessibility: '', latitude: 0, longitude: 0 },
            ])
          }
        >
          Tambah titik
        </button>
      </section>
      <section className="form-section">
        <h3>Informasi akses & rute</h3>
        {routes.map((route, i) => (
          <fieldset key={i}>
            <legend>Akses {i + 1}</legend>
            {(['name', 'description', 'reviewNote'] as const).map((field) => (
              <Field
                key={field}
                label={
                  {
                    name: 'Nama akses',
                    description: 'Keterangan akses',
                    reviewNote: 'Catatan tinjauan kondisi',
                  }[field]
                }
              >
                <input
                  required
                  value={route[field]}
                  onChange={(e) =>
                    setRoutes(
                      routes.map((r, n) => (n === i ? { ...r, [field]: e.target.value } : r)),
                    )
                  }
                />
              </Field>
            ))}
            <button type="button" onClick={() => setRoutes(routes.filter((_, n) => n !== i))}>
              Hapus akses {i + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => setRoutes([...routes, { name: '', description: '', reviewNote: '' }])}
        >
          Tambah informasi akses
        </button>
      </section>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          Simpan draf
        </button>
        <button type="button" onClick={onClose}>
          Batalkan
        </button>
      </div>
    </form>
  );
}
export function AssistancePage({ region, user, run }: ManagementProps) {
  const query = useQuery({
    queryKey: ['assistance', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/assistance', z.array(assistanceSchema)),
  });
  return (
    <>
      <PageHeader
        eyebrow="Akses terbatas / tindak lanjut"
        title="Kebutuhan warga, ditangani dengan hati-hati."
        description="Detail hanya dibuka koordinator wilayah. Status menunjukkan tindak lanjut komunitas, bukan pengiriman layanan darurat."
      />
      <Notice tone="warning">
        Jangan menjanjikan waktu respons atau bantuan layanan darurat melalui status platform.
      </Notice>
      {query.isPending ? (
        <div className="loading">Memuat tindak lanjut…</div>
      ) : query.isError ? (
        <Notice tone="error">Tidak dapat memuat permintaan terbatas.</Notice>
      ) : query.data?.length ? (
        query.data.map((a) => <AssistanceCard key={a.id} item={a} region={region} run={run} />)
      ) : (
        <Empty title="Belum ada permintaan tindak lanjut">
          Kebutuhan yang disampaikan akan muncul setelah diterima server.
        </Empty>
      )}
    </>
  );
}
function AssistanceCard({
  item,
  region,
  run,
}: {
  item: z.infer<typeof assistanceSchema>;
  region: ManagementProps['region'];
  run: ManagementProps['run'];
}) {
  const [state, setState] = useState(
    item.state === 'received' ? 'assigned' : item.state === 'closed' ? 'closed' : 'in_progress',
  );
  const [note, setNote] = useState('');
  const [assigned, setAssigned] = useState(!!item.organizationId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <div className="panel-heading">
        <Link to={'/reports/' + item.reportId}>Laporan {item.reportId.slice(0, 8)}</Link>
        <Badge tone="amber">{item.state} · akses terbatas</Badge>
      </div>
      <p>{item.description}</p>
      <p className="hint">
        Kontak privat: {item.contactDetails || 'Tidak diberikan'} · diperbarui{' '}
        {formatTime(item.updatedAt)}
      </p>
      {item.note && <Notice>Catatan terakhir: {item.note}</Notice>}
      {item.state !== 'closed' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await run(() =>
                request('/regions/' + region.id + '/assistance/' + item.id, ok, {
                  method: 'POST',
                  body: { state, note, organizationId: assigned ? region.organizationId : null },
                }),
              );
              setNote('');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Perubahan gagal.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Status tindak lanjut">
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="assigned">Ditugaskan</option>
                <option value="in_progress">Dalam tindak lanjut</option>
                <option value="closed">Ditutup</option>
              </select>
            </Field>
            <Field label="Penanggung jawab">
              <select
                value={assigned ? 'yes' : 'no'}
                onChange={(e) => setAssigned(e.target.value === 'yes')}
              >
                <option value="no">Belum ditugaskan</option>
                <option value="yes">{region.organization}</option>
              </select>
            </Field>
          </div>
          <Field label="Catatan tindak lanjut">
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button className="primary" disabled={busy}>
            Simpan tindak lanjut
          </button>
        </form>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
export function SourcesPage({ region, user, run }: ManagementProps) {
  const query = useQuery({
    queryKey: ['sources', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/sources', z.array(sourceSchema)),
  });
  const [editing, setEditing] = useState<Source | null | undefined>();
  const [error, setError] = useState('');
  return (
    <>
      <PageHeader
        eyebrow="Integrasi / atribusi / kesegaran"
        title="Sumber yang dapat ditelusuri."
        description="Prakiraan cuaca, laporan urun daya, dan simulasi tetap dipisahkan. Kegagalan satu sumber tidak mematikan alur pelaporan."
        action={
          user.role === 'admin' ? (
            <button className="primary" onClick={() => setEditing(null)}>
              Tambah sumber
            </button>
          ) : undefined
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {editing !== undefined ? (
        <SourceEditor
          source={editing ?? undefined}
          regionId={region.id}
          run={run}
          onClose={() => setEditing(undefined)}
        />
      ) : (
        <section className="panel">
          {query.isPending ? (
            <div className="loading">Memuat sumber…</div>
          ) : query.isError ? (
            <Notice tone="error">Tidak dapat membaca status sumber.</Notice>
          ) : (
            query.data?.map((s) => (
              <div key={s.id} className="source-details">
                <div>
                  <h3>{s.name}</h3>
                  <div className="actions">
                    <Badge tone={s.lastError ? 'amber' : s.enabled ? 'teal' : 'neutral'}>
                      {s.enabled ? s.mode : 'Dinonaktifkan'}
                    </Badge>
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                      Dokumentasi sumber ↗
                    </a>
                  </div>
                  <p>{s.licenseNote}</p>
                  <p className="meta">
                    Percobaan {formatTime(s.lastAttemptAt)} · berhasil {formatTime(s.lastSuccessAt)}
                  </p>
                  {s.lastError && (
                    <Notice tone="warning">
                      {s.lastError}. Data lama tetap memiliki waktu asli; tidak tampil sebagai
                      pembaruan baru.
                    </Notice>
                  )}
                </div>
                <div className="actions">
                  <button
                    disabled={!s.enabled}
                    onClick={async () => {
                      try {
                        await run(
                          () =>
                            request('/regions/' + region.id + '/sources/' + s.id + '/refresh', ok, {
                              method: 'POST',
                            }),
                          'Pembaruan dijadwalkan. Periksa waktu dan status setelah worker memproses.',
                        );
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Pembaruan gagal.');
                      }
                    }}
                  >
                    Perbarui sumber
                  </button>
                  {user.role === 'admin' && (
                    <button onClick={() => setEditing(s)}>Konfigurasi</button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}
function SourceEditor({
  source,
  regionId,
  run,
  onClose,
}: {
  source: Source | undefined;
  regionId: string;
  run: ManagementProps['run'];
  onClose: () => void;
}) {
  const [name, setName] = useState(source?.name ?? '');
  const [provider, setProvider] = useState(source?.provider ?? 'fixture');
  const [enabled, setEnabled] = useState(source?.enabled ?? false);
  const [mode, setMode] = useState(source?.mode ?? 'simulation');
  const [url, setUrl] = useState(source?.sourceUrl ?? 'https://example.org/tandara/simulation');
  const [license, setLicense] = useState(
    source?.licenseNote ?? 'Fixture sintetis; bukan kejadian nyata.',
  );
  const [authorized, setAuthorized] = useState(source?.config['authorized'] === true);
  const [adm4, setAdm4] = useState(String(source?.config['adm4'] ?? ''));
  const [admin, setAdmin] = useState(String(source?.config['admin'] ?? ''));
  const [province, setProvince] = useState(String(source?.config['province'] ?? ''));
  const [fail, setFail] = useState(source?.config['fail'] === true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(() =>
            request('/regions/' + regionId + '/sources', z.object({ id: z.uuid() }), {
              method: 'POST',
              body: {
                ...(source ? { id: source.id } : {}),
                name,
                provider,
                enabled,
                mode,
                sourceUrl: url,
                licenseNote: license,
                config: {
                  authorized,
                  ...(adm4 ? { adm4 } : {}),
                  ...(admin ? { admin } : {}),
                  ...(province ? { province } : {}),
                  fail,
                },
              },
            }),
          );
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Konfigurasi gagal.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Konfigurasi sumber</h2>
      <Field label="Nama sumber">
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} />
      </Field>
      <div className="form-grid">
        <Field label="Provider">
          <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
            {['fixture', 'bmkg', 'bmkg_nowcast', 'petabencana', 'inarisk'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="simulation">Simulasi</option>
            <option value="disabled">Dinonaktifkan</option>
            <option value="live">Live (memerlukan izin)</option>
          </select>
        </Field>
      </div>
      <Field label="URL sumber / dokumentasi">
        <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label="Catatan lisensi & izin">
        <textarea
          required
          minLength={5}
          value={license}
          onChange={(e) => setLicense(e.target.value)}
        />
      </Field>
      {provider === 'bmkg' && (
        <Field label="Kode desa / kelurahan adm4">
          <input
            value={adm4}
            onChange={(e) => setAdm4(e.target.value)}
            placeholder="31.75.03.1002 (Bidara Cina)"
          />
        </Field>
      )}
      {provider === 'bmkg_nowcast' && (
        <Field label="Nama provinsi sesuai BMKG">
          <input
            required
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="DKI Jakarta"
          />
          <span className="meta">
            Peringatan CAP resmi; hanya polygon yang beririsan dengan batas wilayah yang
            ditampilkan. Data kosong bukan tanda aman.
          </span>
        </Field>
      )}
      {provider === 'petabencana' && (
        <Field label="Kode provinsi">
          <input value={admin} onChange={(e) => setAdmin(e.target.value)} placeholder="ID-JK" />
        </Field>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Aktifkan sumber untuk wilayah ini
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
        />
        Izin sumber dan penggunaan telah ditinjau oleh pengelola
      </label>
      {provider === 'fixture' && (
        <label className="checkbox">
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
          Simulasikan gangguan provider untuk pengujian
        </label>
      )}
      <Notice>
        Aktivasi live juga memerlukan ALLOW_LIVE_SOURCES=true pada server. URL ini untuk atribusi;
        endpoint jaringan ditentukan adapter, sehingga konfigurasi tidak menjadi akses jaringan
        sembarang.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          Simpan konfigurasi
        </button>
        <button type="button" onClick={onClose}>
          Batalkan
        </button>
      </div>
    </form>
  );
}
export function AuditPage({
  region,
  user,
}: ManagementProps | Pick<ManagementProps, 'region' | 'user'>) {
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const query = useQuery({
    queryKey: ['audit', user.id, region.id, q],
    queryFn: () =>
      request('/regions/' + region.id + '/audit?q=' + encodeURIComponent(q), z.array(auditSchema)),
  });
  return (
    <>
      <PageHeader
        eyebrow="Akuntabilitas / riwayat"
        title="Setiap keputusan meninggalkan jejak."
        description="Catatan audit bersifat append-only. Tampilan dibatasi ke 200 kejadian terbaru sesuai akses wilayah."
      />
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft);
        }}
      >
        <label className="field search">
          Cari tindakan
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={100} />
        </label>
        <button>Cari</button>
      </form>
      {query.isPending ? (
        <div className="loading">Memuat jejak audit…</div>
      ) : query.isError ? (
        <Notice tone="error">Audit tidak dapat dimuat.</Notice>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pelaku</th>
                <th>Tindakan</th>
                <th>Objek / metadata</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((a) => (
                <tr key={a.id}>
                  <td>{formatTime(a.createdAt)}</td>
                  <td>{a.actor ?? 'Sistem'}</td>
                  <td className="audit-action">{a.action}</td>
                  <td>
                    <span className="code">{a.entityId ?? '—'}</span>
                    <details>
                      <summary>Detail tindakan</summary>
                      <pre className="code">{JSON.stringify(a.metadata, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export function TrainingManagement({ region, user, run }: ManagementProps) {
  const query = useQuery({
    queryKey: ['training-management', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/training/outcomes', z.array(trainingSchema)),
  });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="Latihan / kesiapsiagaan"
        title="Belajar sebelum dibutuhkan."
        description="Seluruh skenario merupakan simulasi. Hasil hanya membantu memperbaiki materi, tidak membuktikan kesiapan atau keamanan individu."
        action={
          <button className="primary" onClick={() => setCreating(!creating)}>
            Buat skenario
          </button>
        }
      />
      {creating && (
        <TrainingEditor regionId={region.id} run={run} onClose={() => setCreating(false)} />
      )}{' '}
      {query.isPending ? (
        <div className="loading">Memuat latihan…</div>
      ) : query.isError ? (
        <Notice tone="error">Hasil latihan tidak dapat dimuat.</Notice>
      ) : (
        query.data?.map((s) => (
          <section className="panel" key={s.id}>
            <div className="panel-heading">
              <h2>{s.content.title}</h2>
              <Badge tone="amber">Simulasi</Badge>
            </div>
            <p>{s.content.description}</p>
            <p className="meta">
              Jadwal {formatTime(s.content.scheduledAt)} · {s.completed} penyelesaian (anonim)
            </p>
            <ol>
              {s.content.steps.map((step, i) => (
                <li key={i}>{step.question}</li>
              ))}
            </ol>
            <details>
              <summary>Feedback untuk perbaikan materi</summary>
              {s.feedback.length ? (
                s.feedback.map((f, i) => <p key={i}>{f || 'Tidak ada komentar'}</p>)
              ) : (
                <p className="hint">Belum ada feedback.</p>
              )}
            </details>
            <button
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      {
                        simulation: true,
                        region: region.name,
                        title: s.content.title,
                        scheduledAt: s.content.scheduledAt,
                        completed: s.completed,
                        feedback: s.feedback,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                );
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'tandara-latihan.json';
                link.click();
                URL.revokeObjectURL(link.href);
              }}
            >
              Ekspor ringkasan latihan
            </button>
          </section>
        ))
      )}
    </>
  );
}
function TrainingEditor({
  regionId,
  run,
  onClose,
}: {
  regionId: string;
  run: ManagementProps['run'];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [steps, setSteps] = useState<Training['content']['steps']>([
    { question: '', options: ['', ''], answer: 0, explanation: '' },
  ]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (i: number, patch: Partial<Training['content']['steps'][number]>) =>
    setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(() =>
            request('/regions/' + regionId + '/training', z.object({ id: z.uuid() }), {
              method: 'POST',
              body: {
                title,
                description,
                scheduledAt: scheduled ? new Date(scheduled).toISOString() : null,
                steps,
              },
            }),
          );
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Skenario gagal disimpan.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Skenario simulasi baru</h2>
      <Field label="Judul latihan">
        <input
          required
          minLength={5}
          maxLength={150}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Tujuan & penjelasan">
        <textarea
          required
          minLength={10}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Jadwal (opsional)">
        <input
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
        />
      </Field>
      {steps.map((s, i) => (
        <fieldset key={i}>
          <legend>Pertanyaan {i + 1}</legend>
          <Field label="Pertanyaan">
            <input
              required
              minLength={5}
              value={s.question}
              onChange={(e) => update(i, { question: e.target.value })}
            />
          </Field>
          {s.options.map((o, j) => (
            <Field key={j} label={'Pilihan ' + (j + 1)}>
              <input
                required
                value={o}
                onChange={(e) =>
                  update(i, { options: s.options.map((v, k) => (j === k ? e.target.value : v)) })
                }
              />
            </Field>
          ))}
          <Field label="Jawaban sesuai materi">
            <select
              value={s.answer}
              onChange={(e) => update(i, { answer: Number(e.target.value) })}
            >
              {s.options.map((_, j) => (
                <option key={j} value={j}>
                  Pilihan {j + 1}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Penjelasan setelah latihan">
            <textarea
              required
              minLength={5}
              value={s.explanation}
              onChange={(e) => update(i, { explanation: e.target.value })}
            />
          </Field>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={steps.length >= 20}
        onClick={() =>
          setSteps([...steps, { question: '', options: ['', ''], answer: 0, explanation: '' }])
        }
      >
        Tambah pertanyaan
      </button>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          Simpan skenario simulasi
        </button>
        <button type="button" onClick={onClose}>
          Batalkan
        </button>
      </div>
    </form>
  );
}
