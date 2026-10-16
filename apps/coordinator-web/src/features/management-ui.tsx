import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  aiRunSchema,
  assistanceSchema,
  auditSchema,
  planSchema,
  planContentSchema,
  sourceSchema,
  trainingSchema,
} from '@tandara/contracts';
import type { Plan, PlanContent, Source, Training } from '@tandara/contracts';
import {
  Badge,
  createUuid,
  Empty,
  Field,
  Notice,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  formatTime,
} from '@tandara/ui';
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
        title="Rencana lokal"
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
          <label className="field mb-4 max-w-2xl">
            <span className="text-xs font-semibold text-muted-foreground">
              Alasan tindakan rencana
            </span>
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
            <div className="overflow-hidden rounded-lg border border-[#e3dfd6] bg-white">
              <div className="hidden gap-3 bg-[#f7f6f2] px-4 py-3 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase xl:grid xl:grid-cols-[minmax(0,1.8fr)_0.45fr_0.8fr_0.85fr_0.8fr] xl:items-center">
                <span>Rencana</span>
                <span>Versi</span>
                <span>Pemilik</span>
                <span>Tinjauan berikut</span>
                <span>Status</span>
              </div>
              {query.data.map((p) => (
                <section
                  className="overflow-hidden border-t border-[#e3dfd6] bg-white first:border-t-0"
                  key={p.id}
                >
                  <div className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1.8fr)_0.45fr_0.8fr_0.85fr_0.8fr] xl:items-center">
                    <div className="font-semibold text-ink">
                      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:hidden">
                        Rencana
                      </span>
                      {p.content.title}
                    </div>
                    <div className="text-sm xl:text-xs">
                      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:hidden">
                        Versi
                      </span>
                      <span className="font-mono tabular-nums">v{p.version}</span>
                    </div>
                    <div className="text-sm">
                      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:hidden">
                        Pemilik
                      </span>
                      {p.owner}
                    </div>
                    <div className="text-sm">
                      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:hidden">
                        Tinjauan berikut
                      </span>
                      {formatTime(p.content.expiresAt)}
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:hidden">
                        Status
                      </span>
                      <Badge tone={p.state === 'published' ? 'teal' : 'amber'}>
                        {{
                          draft: 'Draf',
                          in_review: 'Dalam tinjauan',
                          approved: 'Disetujui',
                          published: 'Terbit',
                          changes_requested: 'Perlu perbaikan',
                          archived: 'Arsip',
                        }[p.state] ?? p.state}
                      </Badge>
                    </div>
                  </div>
                  <div className="border-t border-[#e3dfd6] px-4 py-3 text-xs text-muted-foreground">
                    Terakhir dibuat {formatTime(p.createdAt)} · Ditinjau{' '}
                    {p.reviewer ?? 'Belum ditinjau'}
                  </div>
                  <details>
                    <summary className="cursor-pointer border-t border-[#e3dfd6] px-4 py-3 text-sm font-semibold text-brand">
                      Instruksi, titik, dan sumber versi ini
                    </summary>
                    <div className="space-y-3 px-4 pb-4">
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
                      <p>Rencana tidak menjamin keamanan rute saat ini.</p>
                    </div>
                  </details>
                  <div className="button-row mt-0 border-t border-[#e3dfd6] px-4 py-3 print:hidden">
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
              ))}
            </div>
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
  const aiRuns = useQuery({
    queryKey: ['plan-ai-runs', regionId],
    queryFn: () => request('/regions/' + regionId + '/ai/runs', z.array(aiRunSchema)),
  });
  const latestPlanDraft = aiRuns.data?.find(
    (r) => r.task === 'plan_draft' && r.output && !r.output.abstained,
  );
  async function requestAiPlanDraft() {
    setBusy(true);
    setError('');
    try {
      await run(
        () =>
          request('/regions/' + regionId + '/ai/runs', z.object({ id: z.uuid() }), {
            method: 'POST',
            body: {
              task: 'plan_draft',
              requestKey: createUuid(),
              hours: 24,
              language: 'id',
              question:
                'Susun draf langkah kesiapsiagaan warga, daftar periksa keluarga, dan persiapan titik kumpul berdasarkan referensi SOP wilayah.',
            },
          }),
        'Penyusunan draf rencana AI & RAG dijadwalkan.',
      );
      await aiRuns.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal meminta draf AI.');
    } finally {
      setBusy(false);
    }
  }
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
      <div className="mb-4 rounded-lg border border-[#cfe0d9] bg-[#f7faf8] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-sm text-ink">Kopilot Penyusun Rencana (AI & RAG)</strong>
            <p className="m-0 text-xs text-muted-foreground">
              Susun usulan instruksi lokal & checklist dari SOP terverifikasi dan laporan wilayah.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="small"
              disabled={busy}
              onClick={() => void requestAiPlanDraft()}
            >
              Buat Usulan Draf AI (RAG)
            </button>
            {latestPlanDraft?.output && (
              <button
                type="button"
                className="small primary"
                onClick={() => {
                  const claimsText = latestPlanDraft.output!.claims.map((c) => c.text);
                  const draftSections =
                    latestPlanDraft.output!.draft?.sections.map((s) => s.text) ?? [];
                  if (claimsText.length) {
                    setInstructions(claimsText.join('\n'));
                  } else if (draftSections.length) {
                    setInstructions(draftSections.join('\n'));
                  }
                  if (latestPlanDraft.output!.questions.length) {
                    setChecklist(latestPlanDraft.output!.questions.join('\n'));
                  }
                  if (!reason) {
                    setReason('Disusun bersama draf asisten AI berdasarkan referensi wilayah');
                  }
                }}
              >
                Terapkan Draf AI ke Form
              </button>
            )}
          </div>
        </div>
        {latestPlanDraft?.output && (
          <p className="mt-2 mb-0 whitespace-pre-line text-xs text-ink">
            {latestPlanDraft.output.title}
          </p>
        )}
      </div>
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
export function AssistancePage({ region, user }: ManagementProps) {
  const query = useQuery({
    queryKey: ['assistance', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/assistance', z.array(assistanceSchema)),
  });
  return (
    <>
      <PageHeader
        eyebrow="Akses terbatas / tindak lanjut"
        title="Permintaan bantuan warga"
        description="Buka laporan untuk menugaskan koordinator dan memperbarui penanganan."
      />
      <Notice tone="warning">
        Jangan menjanjikan waktu respons atau bantuan layanan darurat melalui status platform.
      </Notice>
      {query.isPending ? (
        <div className="loading">Memuat tindak lanjut…</div>
      ) : query.isError ? (
        <Notice tone="error">Tidak dapat memuat permintaan terbatas.</Notice>
      ) : query.data?.length ? (
        query.data.map((a) => <AssistanceCard key={a.id} item={a} />)
      ) : (
        <Empty title="Belum ada permintaan tindak lanjut">
          Kebutuhan yang disampaikan akan muncul setelah diterima server.
        </Empty>
      )}
    </>
  );
}
function AssistanceCard({ item }: { item: z.infer<typeof assistanceSchema> }) {
  const labels: Record<string, string> = {
    received: 'Diterima',
    assigned: 'Ditugaskan',
    in_progress: 'Sedang ditangani',
    closed: 'Selesai',
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Permintaan bantuan</h2>
        <Badge>{labels[item.state] ?? item.state}</Badge>
      </div>
      <p>{item.description}</p>
      <p className="hint">Kontak warga: {item.contactDetails || 'Tidak diberikan'}</p>
      <p className="hint">Diperbarui {formatTime(item.updatedAt)}</p>
      <Link className="button primary" to={'/reports/' + item.reportId}>
        Buka penanganan laporan
      </Link>
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
        title="Sumber informasi"
        description="Periksa status prakiraan cuaca dan informasi wilayah dari sumber yang terhubung."
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
        <section className="panel overflow-hidden rounded-lg border-[#e3dfd6] p-0">
          {query.isPending ? (
            <div className="loading">Memuat sumber…</div>
          ) : query.isError ? (
            <Notice tone="error">Tidak dapat membaca status sumber.</Notice>
          ) : (
            query.data
              ?.filter((s) => s.provider !== 'fixture')
              .map((s) => (
                <div key={s.id} className="source-details px-5 py-5 lg:flex-row lg:items-center">
                  <div>
                    <h3 className="mb-2 text-base font-semibold">{s.name}</h3>
                    <div className="actions">
                      <Badge tone={s.lastError ? 'amber' : s.enabled ? 'teal' : 'neutral'}>
                        {s.enabled ? s.mode : 'Dinonaktifkan'}
                      </Badge>
                      <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                        Dokumentasi sumber ↗
                      </a>
                    </div>
                    <p>{s.licenseNote}</p>
                    <div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <p className="m-0">
                        Percobaan terakhir{' '}
                        <span className="font-medium text-ink">{formatTime(s.lastAttemptAt)}</span>
                      </p>
                      <p className="m-0">
                        Berhasil terakhir{' '}
                        <span className="font-medium text-ink">{formatTime(s.lastSuccessAt)}</span>
                      </p>
                    </div>
                    {s.lastError && (
                      <Notice tone="warning">
                        {s.lastError}. Data lama tetap memiliki waktu asli; tidak tampil sebagai
                        pembaruan baru.
                      </Notice>
                    )}
                  </div>
                  <div className="actions shrink-0 sm:justify-end">
                    <button
                      disabled={!s.enabled}
                      onClick={async () => {
                        try {
                          await run(
                            () =>
                              request(
                                '/regions/' + region.id + '/sources/' + s.id + '/refresh',
                                ok,
                                {
                                  method: 'POST',
                                },
                              ),
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
  const [provider, setProvider] = useState(source?.provider ?? 'bmkg');
  const [enabled, setEnabled] = useState(source?.enabled ?? false);
  const [mode, setMode] = useState(source?.mode ?? 'disabled');
  const [url, setUrl] = useState(source?.sourceUrl ?? '');
  const [license, setLicense] = useState(source?.licenseNote ?? '');
  const [authorized, setAuthorized] = useState(source?.config['authorized'] === true);
  const [adm4, setAdm4] = useState(String(source?.config['adm4'] ?? ''));
  const [admin, setAdmin] = useState(String(source?.config['admin'] ?? ''));
  const [province, setProvince] = useState(String(source?.config['province'] ?? ''));
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
          <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}>
            <SelectTrigger aria-label="Provider sumber">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['bmkg', 'bmkg_nowcast', 'petabencana', 'inarisk'].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Mode">
          <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
            <SelectTrigger aria-label="Mode sumber">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="disabled">Dinonaktifkan</SelectItem>
              <SelectItem value="live">Live (memerlukan izin)</SelectItem>
            </SelectContent>
          </Select>
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
      <Notice>
        Sumber aktif menampilkan informasi terbaru dari penyedia. Pastikan izin penggunaan dan
        cakupan wilayah sudah sesuai.
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
        title="Latihan"
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
          <section
            className="mb-4 overflow-hidden rounded-lg border border-[#e3dfd6] bg-white"
            key={s.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e3dfd6] px-5 py-4 sm:px-6">
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  SIMULASI / LATIHAN
                </p>
                <h2 className="mb-1 text-lg">{s.content.title}</h2>
                <p className="mb-0 text-sm text-muted-foreground">{s.content.description}</p>
              </div>
              <Badge tone="amber">Simulasi</Badge>
            </div>
            <div className="grid gap-4 bg-[#f7f6f2] px-5 py-3 text-sm sm:grid-cols-2 sm:px-6">
              <div>
                <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Jadwal
                </span>
                <span className="font-medium">{formatTime(s.content.scheduledAt)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Penyelesaian anonim
                </span>
                <span className="font-sans font-semibold tabular-nums">{s.completed}</span>
              </div>
            </div>
            <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr] lg:px-6">
              <div>
                <h3 className="mb-3 text-sm">Tahapan latihan</h3>
                <ol className="m-0 space-y-2 pl-5 text-sm">
                  {s.content.steps.map((step, i) => (
                    <li className="pl-1 leading-relaxed" key={i}>
                      {step.question}
                    </li>
                  ))}
                </ol>
              </div>
              <details className="border-t border-[#e3dfd6] pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
                <summary className="cursor-pointer text-sm font-semibold">
                  Feedback untuk perbaikan materi
                </summary>
                {s.feedback.length ? (
                  s.feedback.map((f, i) => <p key={i}>{f || 'Tidak ada komentar'}</p>)
                ) : (
                  <p className="hint">Belum ada feedback.</p>
                )}
              </details>
            </div>
            <div className="border-t border-[#e3dfd6] px-5 py-3 sm:px-6">
              <button
                className="small"
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
            </div>
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
  const aiRuns = useQuery({
    queryKey: ['training-ai-runs', regionId],
    queryFn: () => request('/regions/' + regionId + '/ai/runs', z.array(aiRunSchema)),
  });
  const latestTrainingDraft = aiRuns.data?.find(
    (r) => r.task === 'training_draft' && r.output && !r.output.abstained,
  );
  async function requestAiTrainingDraft() {
    setBusy(true);
    setError('');
    try {
      await run(
        () =>
          request('/regions/' + regionId + '/ai/runs', z.object({ id: z.uuid() }), {
            method: 'POST',
            body: {
              task: 'training_draft',
              requestKey: createUuid(),
              hours: 24,
              language: 'id',
              question:
                'Susun draf skenario latihan simulasi kesiapsiagaan warga berdasarkan SOP evakuasi mandiri, keselamatan listrik, dan titik kumpul wilayah.',
            },
          }),
        'Penyusunan draf skenario latihan AI & RAG dijadwalkan.',
      );
      await aiRuns.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal meminta draf AI.');
    } finally {
      setBusy(false);
    }
  }
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
      <div className="mb-4 rounded-lg border border-[#cfe0d9] bg-[#f7faf8] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-sm text-ink">Kopilot Skenario Latihan (AI & RAG)</strong>
            <p className="m-0 text-xs text-muted-foreground">
              Susun draf tujuan dan pertanyaan simulasi warga dari basis pengetahuan wilayah.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="small"
              disabled={busy}
              onClick={() => void requestAiTrainingDraft()}
            >
              Buat Usulan Skenario AI (RAG)
            </button>
            {latestTrainingDraft?.output && (
              <button
                type="button"
                className="small primary"
                onClick={() => {
                  if (!title) {
                    setTitle('Simulasi Kesiapsiagaan & Titik Kumpul Warga');
                  }
                  const draftSections =
                    latestTrainingDraft.output!.draft?.sections.map(
                      (s) => `${s.heading}: ${s.text}`,
                    ) ?? [];
                  if (draftSections.length) {
                    setDescription(draftSections.join('\n'));
                  } else {
                    setDescription(latestTrainingDraft.output!.title);
                  }
                  const claimSteps = latestTrainingDraft
                    .output!.claims.slice(0, 3)
                    .map((c, idx) => ({
                      question:
                        latestTrainingDraft.output!.questions[idx] ??
                        `Langkah apa yang sesuai referensi wilayah terkait poin ${idx + 1}?`,
                      options: [
                        c.text.slice(0, 140),
                        'Menunggu kabar tidak terverifikasi tanpa memeriksa rencana wilayah',
                      ],
                      answer: 0,
                      explanation: c.text.slice(0, 240),
                    }));
                  if (claimSteps.length) {
                    setSteps(claimSteps);
                  }
                }}
              >
                Terapkan Skenario AI ke Form
              </button>
            )}
          </div>
        </div>
      </div>
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
            <Select
              value={String(s.answer)}
              onValueChange={(value) => update(i, { answer: Number(value) })}
            >
              <SelectTrigger aria-label={'Jawaban sesuai materi, pertanyaan ' + (i + 1)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {s.options.map((_, j) => (
                  <SelectItem key={j} value={String(j)}>
                    Pilihan {j + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
