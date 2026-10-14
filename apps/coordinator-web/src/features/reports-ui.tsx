import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  reportDetailSchema,
  reportPageSchema,
  sourceSchema,
  assistanceSchema,
  triageSchema,
} from '@tandara/contracts';
import type { Region, User, Report } from '@tandara/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  Field,
  Icon,
  Input,
  Notice,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatTime,
} from '@tandara/ui';
import type { ManagementProps } from './posko-app.js';

export const categories: Record<string, string> = {
  road_flooding: 'Genangan di jalan',
  water_entering_homes: 'Air masuk rumah',
  blocked_access: 'Akses terhalang',
  debris: 'Material / sampah',
  damaged_facility: 'Fasilitas rusak',
  follow_up_needed: 'Perlu tindak lanjut',
  other: 'Lainnya',
};
export const statuses: Record<string, string> = {
  submitted: 'Menunggu tinjauan',
  under_review: 'Sedang ditinjau',
  clarification_requested: 'Perlu klarifikasi',
  reviewed: 'Ditinjau koordinator',
  rejected: 'Tidak dapat dikonfirmasi',
  closed: 'Ditutup',
};
export const ok = z.object({ ok: z.boolean() });
export function Overview({ region, user }: { region: Region; user: User }) {
  const reports = useQuery({
    queryKey: ['overview-reports', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/reports', reportPageSchema),
  });
  const pending = useQuery({
    queryKey: ['pending', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/reports?state=submitted', reportPageSchema),
  });
  const sources = useQuery({
    queryKey: ['sources', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/sources', z.array(sourceSchema)),
  });
  const assistance = useQuery({
    queryKey: ['assistance', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/assistance', z.array(assistanceSchema)),
  });
  const summary = useQuery({
    queryKey: ['triage-summary', user.id, region.id],
    queryFn: () =>
      request(
        '/regions/' + region.id + '/triage-summary',
        z.object({
          provider: z.literal('deterministic'),
          needsHumanReview: z.literal(true),
          generatedAt: z.string(),
          sourceIds: z.array(z.uuid()),
          summary: z.string(),
          groups: z.record(z.string(), z.number()),
        }),
      ),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RINGKASAN WILAYAH"
        title="Pahami kabar. Tentukan tindak lanjut."
        description={
          'Ringkasan informasi komunitas ' +
          region.name +
          '. Semua angka berasal dari catatan platform.'
        }
        action={
          <Button asChild>
            <Link to="/inbox">
              Buka kotak laporan <Icon name="arrow" size={16} />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon="inbox"
          label="Menunggu tinjauan"
          value={pending.data?.total ?? '—'}
          note="Laporan baru"
          href="/inbox"
          tone="amber"
        />
        <MetricCard
          icon="help"
          label="Tindak lanjut terbuka"
          value={assistance.data?.filter((a) => a.state !== 'closed').length ?? '—'}
          note="Permintaan bantuan"
          href="/assistance"
          tone="teal"
        />
        <MetricCard
          icon="source"
          label="Sumber bermasalah"
          value={sources.data?.filter((s) => s.enabled && s.lastError).length ?? '—'}
          note="Sumber aktif dengan kendala"
          href="/sources"
          tone={sources.data?.some((s) => s.enabled && s.lastError) ? 'amber' : 'neutral'}
        />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <CardTitle>Kabar masuk terbaru</CardTitle>
              <p className="mb-0 mt-1 text-xs text-muted-foreground">
                Laporan terkini untuk wilayah ini
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/inbox">
                Lihat semua <Icon name="arrow" size={14} />
              </Link>
            </Button>
          </CardHeader>
          {reports.isPending ? (
            <div className="space-y-3 p-5" role="status">
              <div className="h-10 animate-pulse rounded bg-[#f0f3f0]" />
              <div className="h-10 animate-pulse rounded bg-[#f0f3f0]" />
              <div className="h-10 animate-pulse rounded bg-[#f0f3f0]" />
              <span className="sr-only">Memuat laporan…</span>
            </div>
          ) : reports.isError ? (
            <div className="p-5">
              <Notice tone="error">Laporan tidak dapat dimuat.</Notice>
            </div>
          ) : reports.data?.items.length ? (
            <ReportTable reports={reports.data.items.slice(0, 6)} />
          ) : (
            <div className="p-5">
              <Empty title="Belum ada laporan">
                Ketiadaan laporan tidak menandakan wilayah aman.
              </Empty>
            </div>
          )}
        </Card>
        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="mb-0 text-xs font-semibold tracking-wide text-brand">
                  RINGKASAN BANTUAN
                </p>
                <Badge tone="neutral">Deterministik</Badge>
              </div>
              <CardTitle>Catatan 24 jam terakhir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {summary.isPending ? (
                <div
                  className="h-12 animate-pulse rounded bg-[#f0f3f0]"
                  role="status"
                  aria-label="Memuat ringkasan"
                />
              ) : summary.isError ? (
                <Notice tone="error">Ringkasan belum dapat dimuat.</Notice>
              ) : (
                <p className="mb-0 leading-relaxed">
                  {summary.data?.summary ?? 'Ringkasan belum tersedia.'}
                </p>
              )}
              <p className="mb-0 text-xs text-muted-foreground">
                Perlu tinjauan manusia · {formatTime(summary.data?.generatedAt ?? null)}
              </p>
              {!!summary.data?.sourceIds.length && (
                <details className="border-t border-line pt-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-brand">
                    Referensi laporan ({summary.data.sourceIds.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summary.data.sourceIds.map((id) => (
                      <Link className="rounded bg-soft px-2 py-1" key={id} to={'/reports/' + id}>
                        {id.slice(0, 8)}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <p className="mb-0 text-xs font-semibold tracking-wide text-brand">
                KUALITAS INFORMASI
              </p>
              <CardTitle>Cakupan pengamatan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="mb-0 leading-relaxed text-muted-foreground">
                Periksa area yang belum memiliki pengamatan terbaru dengan lokasi dan waktu yang
                jelas.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/map">
                  Buka peta situasi <Icon name="arrow" size={14} />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Sumber informasi</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/sources">Detail</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sources.data?.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
                >
                  <div className="min-w-0">
                    <h3 className="mb-1 truncate text-sm font-medium">{s.name}</h3>
                    <Badge tone={s.lastError ? 'amber' : s.enabled ? 'teal' : 'neutral'}>
                      {s.enabled
                        ? s.lastError
                          ? 'Gagal memperbarui'
                          : s.mode === 'simulation'
                            ? 'Simulasi aktif'
                            : 'Aktif'
                        : 'Dinonaktifkan'}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
function MetricCard({
  icon,
  label,
  value,
  note,
  href,
  tone,
}: {
  icon: 'inbox' | 'help' | 'source';
  label: string;
  value: number | string;
  note: string;
  href: string;
  tone: 'neutral' | 'teal' | 'amber';
}) {
  const iconTone = {
    neutral: 'bg-[#f0f3f0] text-muted-foreground',
    teal: 'bg-[#edf5ef] text-brand',
    amber: 'bg-[#fff7e8] text-[#744b15]',
  }[tone];
  return (
    <Card className="transition-colors hover:border-[#bfd0c4]">
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mb-1 text-3xl font-semibold tabular-nums tracking-[-1px] text-ink">
            {value}
          </p>
          <Link
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
            to={href}
          >
            {note}
          </Link>
        </div>
        <span className={`grid size-9 shrink-0 place-items-center rounded-md ${iconTone}`}>
          <Icon name={icon} size={18} />
        </span>
      </CardContent>
    </Card>
  );
}
function ReportTable({ reports }: { reports: Report[] }) {
  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="bg-[#f8faf7] hover:bg-[#f8faf7]">
          <TableHead>Laporan & lokasi</TableHead>
          <TableHead>Jenis</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Diterima</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="min-w-[250px]">
              <Link
                className="mb-1 block max-w-[40ch] font-semibold leading-snug text-ink no-underline hover:text-brand hover:underline"
                to={'/reports/' + r.id}
              >
                {r.description.slice(0, 100)}
                {r.description.length > 100 ? '…' : ''}
              </Link>
              <span className="text-xs text-muted-foreground">
                {r.landmarkText || 'Lokasi belum jelas'}
              </span>
              {r.followUpRequested && (
                <div className="mt-1.5">
                  <Badge tone="amber">Bantuan · akses terbatas</Badge>
                </div>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {categories[r.category]}
              <div className="mt-1 text-xs text-muted-foreground">Laporan warga · simulasi</div>
            </TableCell>
            <TableCell>
              <Badge
                tone={r.state === 'reviewed' ? 'teal' : r.state === 'rejected' ? 'red' : 'amber'}
              >
                {statuses[r.state]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs tabular-nums">
              <span className="text-ink">{formatTime(r.createdAt)}</span>
              <div className="mt-1 text-muted-foreground">
                Pengamatan {formatTime(r.observationTime)}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function Inbox({ region, user }: { region: Region; user: User }) {
  const [q, setQ] = useState('');
  const [draftQ, setDraftQ] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    page: String(page),
    q,
    sort,
    ...(state ? { state } : {}),
    ...(category ? { category } : {}),
  });
  const reports = useQuery({
    queryKey: ['inbox', user.id, region.id, q, state, category, sort, page],
    queryFn: () =>
      request('/regions/' + region.id + '/reports?' + query.toString(), reportPageSchema),
  });
  return (
    <>
      <PageHeader
        eyebrow="Laporan warga / Triase"
        title="Kotak laporan"
        description="Periksa sumber asli sebelum mengambil keputusan. Saran AI tidak mengubah status laporan."
      />
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draftQ);
          setPage(1);
        }}
      >
        <label className="field search">
          Cari teks / patokan
          <Input
            type="search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            maxLength={100}
            placeholder="Cari laporan…"
          />
        </label>
        <label className="field">
          Status
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua status</option>
            {Object.entries(statuses).map(([s, l]) => (
              <option key={s} value={s}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Jenis
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua jenis</option>
            {region.config.categories.map((c) => (
              <option value={c} key={c}>
                {categories[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Urutan
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </select>
        </label>
        <Button type="submit">Cari</Button>
        <Button type="button" variant="outline" onClick={() => void reports.refetch()}>
          Perbarui
        </Button>
      </form>
      {reports.isPending ? (
        <div className="loading">Memuat kotak laporan…</div>
      ) : reports.isError ? (
        <Notice tone="error">Tidak dapat memuat laporan. Coba perbarui atau masuk kembali.</Notice>
      ) : reports.data?.items.length ? (
        <>
          <Card className="overflow-hidden">
            <ReportTable reports={reports.data.items} />
          </Card>
          <div className="pagination">
            <span>
              {reports.data.total} laporan · halaman {page}
            </span>
            <div className="actions">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= reports.data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Empty title="Tidak ada laporan dalam filter ini">
          Ubah filter atau periksa kembali nanti. Wilayah tanpa laporan tidak berarti aman.
        </Empty>
      )}
    </>
  );
}
export function ReportDetailPage({ id, region, user, run }: ManagementProps & { id: string }) {
  const query = useQuery({
    queryKey: ['report', user.id, id],
    queryFn: () => request('/reports/' + id, reportDetailSchema),
    refetchInterval: 10000,
  });
  const [state, setState] = useState('reviewed');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [aiEdit, setAiEdit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await run(action);
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan gagal.');
    } finally {
      setBusy(false);
    }
  }
  const d = query.data;
  if (query.isPending) return <div className="loading">Memuat laporan asli…</div>;
  if (query.isError || !d)
    return (
      <Notice tone="error">
        Laporan tidak ditemukan, sesi berakhir, atau akun Anda tidak berwenang mengakses wilayahnya.
      </Notice>
    );
  const r = d.report;
  const suggestion = d.suggestions[0];
  return (
    <>
      <div className="breadcrumb">
        <Link to="/inbox">Kotak laporan</Link> / {id.slice(0, 8)}
      </div>
      <PageHeader
        eyebrow="Detail laporan warga"
        title={categories[r.category] ?? r.category}
        description={r.landmarkText || 'Lokasi belum cukup jelas'}
        action={<Badge tone={r.state === 'reviewed' ? 'teal' : 'amber'}>{statuses[r.state]}</Badge>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <h2>Laporan asli</h2>
            {r.simulation && <Badge tone="amber">Simulasi</Badge>}
          </div>
          <p className="raw-report">{r.description}</p>
          <div className="meta">
            <span>Diterima {formatTime(r.createdAt)}</span>
            <span>Pengamatan {formatTime(r.observationTime)}</span>
            <span>Patokan: {r.landmarkText || 'Tidak diketahui'}</span>
            <span>
              Koordinat {r.latitude === null ? 'Tidak diketahui' : r.latitude + ', ' + r.longitude}
            </span>
            <span>Sumber: warga · revisi {r.revision}</span>
          </div>
          {r.followUpRequested && (
            <Notice tone="warning">
              Kebutuhan tindak lanjut — akses terbatas. Bukan permintaan pengiriman layanan darurat.
              <p>Kontak: {r.contactDetails || 'Tidak diberikan'}</p>
              <Link to="/assistance">Buka antrean tindak lanjut</Link>
            </Notice>
          )}
          {d.attachments.length > 0 && (
            <>
              <hr />
              <h3>Foto privat</h3>
              {d.attachments.map((a) => (
                <a
                  key={a.id}
                  href={'/api/v1/reports/' + id + '/attachments/' + a.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.name} · {formatTime(a.createdAt)} →
                </a>
              ))}
            </>
          )}
        </section>
        <section className="panel ai-panel">
          <p className="eyebrow">Saran pendukung / Perlu tinjauan manusia</p>
          <div className="panel-heading">
            <h2>Asisten triase</h2>
            <Badge>{suggestion?.state ?? 'Menunggu proses'}</Badge>
          </div>
          {suggestion ? (
            <>
              <p className="hint">
                {suggestion.provider === 'deterministic'
                  ? 'Aturan kata kunci deterministik — bukan inferensi model AI.'
                  : 'Saran AI — belum menjadi keputusan koordinator.'}
              </p>
              <p className="meta">
                {suggestion.model} · prompt {suggestion.promptVersion} · {suggestion.durationMs} ms
              </p>
              {suggestion.output ? (
                <>
                  <h3>
                    Saran kategori:{' '}
                    {suggestion.output.suggestedCategory
                      ? categories[suggestion.output.suggestedCategory]
                      : 'Belum diketahui'}
                  </h3>
                  <p>{suggestion.output.summary}</p>
                  {suggestion.reviewedOutput && (
                    <>
                      <h4>Hasil koreksi koordinator</h4>
                      <p>{suggestion.reviewedOutput.summary}</p>
                    </>
                  )}
                  {suggestion.legacyProvenance && (
                    <Notice tone="warning">
                      Saran lama pernah dikoreksi sebelum riwayat asli disimpan; asal lengkap tidak
                      dapat dipulihkan.
                    </Notice>
                  )}
                  {!!suggestion.reviews?.length && (
                    <details>
                      <summary>Riwayat tinjauan saran</summary>
                      {suggestion.reviews.map((r) => (
                        <p key={r.id}>
                          {r.action} · {formatTime(r.createdAt)} · {r.note}
                        </p>
                      ))}
                    </details>
                  )}
                  {suggestion.output.missingInformation.map((m, i) => (
                    <Notice key={i} tone="warning">
                      {m}
                    </Notice>
                  ))}
                  <details>
                    <summary>Fakta yang dikutip & referensi</summary>
                    {suggestion.output.facts.map((f, i) => (
                      <div className="evidence" key={i}>
                        <strong>{f.field}</strong>
                        {f.evidence}
                      </div>
                    ))}
                    <p className="code">Sumber laporan: {suggestion.output.sourceIds.join(', ')}</p>
                  </details>
                  {suggestion.state === 'ready' && (
                    <>
                      <Field label="Catatan tinjauan saran">
                        <textarea
                          value={aiNote}
                          onChange={(e) => setAiNote(e.target.value)}
                          minLength={5}
                          maxLength={1000}
                        />
                      </Field>
                      <details>
                        <summary>Koreksi ringkasan saran</summary>
                        <p className="hint">
                          Isi sumber asli tetap dipertahankan. Koreksi saran tidak mengubah
                          verifikasi.
                        </p>
                        <textarea
                          aria-label="Koreksi ringkasan saran"
                          value={aiEdit || suggestion.output.summary}
                          onChange={(e) => setAiEdit(e.target.value)}
                        />
                      </details>
                      <div className="button-row">
                        <button
                          disabled={busy || aiNote.length < 5}
                          onClick={() =>
                            void act(() =>
                              request(
                                '/reports/' + id + '/suggestions/' + suggestion.id + '/review',
                                ok,
                                { method: 'POST', body: { action: 'accepted', note: aiNote } },
                              ),
                            )
                          }
                        >
                          Terima saran
                        </button>
                        <button
                          disabled={busy || aiNote.length < 5}
                          onClick={() =>
                            void act(() =>
                              request(
                                '/reports/' + id + '/suggestions/' + suggestion.id + '/review',
                                ok,
                                {
                                  method: 'POST',
                                  body: {
                                    action: 'edited',
                                    note: aiNote,
                                    output: triageSchema.parse({
                                      ...suggestion.output,
                                      summary: aiEdit || suggestion.output!.summary,
                                    }),
                                  },
                                },
                              ),
                            )
                          }
                        >
                          Simpan koreksi
                        </button>
                        <button
                          disabled={busy || aiNote.length < 5}
                          className="danger"
                          onClick={() =>
                            void act(() =>
                              request(
                                '/reports/' + id + '/suggestions/' + suggestion.id + '/review',
                                ok,
                                { method: 'POST', body: { action: 'rejected', note: aiNote } },
                              ),
                            )
                          }
                        >
                          Tolak saran
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Notice tone="warning">
                  Pemrosesan gagal. Tinjauan manusia tetap dapat dilakukan.
                </Notice>
              )}
            </>
          ) : (
            <Empty title="Saran belum tersedia">Koordinator dapat meninjau laporan tanpa AI.</Empty>
          )}
          <button
            className="small"
            disabled={busy}
            onClick={() =>
              void act(() => request('/reports/' + id + '/triage', ok, { method: 'POST' }))
            }
          >
            Proses ulang saran
          </button>
        </section>
      </div>
      <div className="split" style={{ marginTop: 24 }}>
        <section className="panel">
          <h2>Keputusan koordinator</h2>
          <p className="hint">
            Catat alasan. Ringkasan publik terpisah dari laporan mentah dan tidak menjadi peringatan
            resmi.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(() =>
                request('/reports/' + id + '/reviews', ok, {
                  method: 'POST',
                  body: {
                    state,
                    reason,
                    revision: r.revision,
                    ...(category ? { category } : {}),
                    ...(summary ? { publicSummary: summary } : {}),
                  },
                }),
              );
            }}
          >
            <div className="form-grid">
              <Field label="Status tujuan">
                <select value={state} onChange={(e) => setState(e.target.value)}>
                  {Object.entries(statuses)
                    .filter(([s]) => s !== r.state && s !== 'submitted')
                    .map(([s, l]) => (
                      <option value={s} key={s}>
                        {l}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Koreksi kategori (opsional)">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Pertahankan kategori</option>
                  {region.config.categories.map((c) => (
                    <option key={c} value={c}>
                      {categories[c]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Alasan keputusan">
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {!r.followUpRequested && state === 'reviewed' && (
              <Field
                label="Ringkasan publik (opsional)"
                hint="Jika diisi, ringkasan diterbitkan setelah keputusan tinjauan ini. Hindari kontak dan detail pribadi."
              >
                <textarea
                  value={summary}
                  maxLength={1000}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </Field>
            )}
            <button className="primary" disabled={busy || r.state === 'closed'}>
              Simpan keputusan manusia
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Riwayat & tanggung jawab</h2>
          <ul className="timeline">
            {d.history.map((h) => (
              <li key={h.id}>
                <strong>{statuses[h.action] ?? h.action}</strong>
                <p>{h.reason}</p>
                <small>
                  {h.actor ?? 'Platform'} · {formatTime(h.createdAt)}
                </small>
              </li>
            ))}
          </ul>
          <h3>Kandidat laporan serupa</h3>
          {d.duplicates.length ? (
            d.duplicates.map((c) => (
              <div className="evidence" key={c.id}>
                <Link to={'/reports/' + c.otherId}>{c.otherDescription}</Link>
                <p>{c.evidence}</p>
                <Badge>{c.state}</Badge>
                <div className="button-row">
                  <button
                    className="small"
                    disabled={busy || reason.length < 5}
                    onClick={() =>
                      void act(() =>
                        request('/reports/' + id + '/duplicates/' + c.id, ok, {
                          method: 'POST',
                          body: { state: 'linked', reason },
                        }),
                      )
                    }
                  >
                    Tautkan sebagai serupa
                  </button>
                  <button
                    className="small"
                    disabled={busy || reason.length < 5}
                    onClick={() =>
                      void act(() =>
                        request('/reports/' + id + '/duplicates/' + c.id, ok, {
                          method: 'POST',
                          body: {
                            state: c.state === 'suggested' ? 'dismissed' : 'suggested',
                            reason,
                          },
                        }),
                      )
                    }
                  >
                    {c.state === 'suggested' ? 'Bukan duplikat' : 'Batalkan keputusan'}
                  </button>
                </div>
                <small>
                  Gunakan alasan keputusan di panel kiri. Laporan tidak digabung atau dihapus.
                </small>
              </div>
            ))
          ) : (
            <p className="hint">Tidak ada kandidat yang memenuhi jendela jarak dan waktu.</p>
          )}
        </section>
      </div>
    </>
  );
}
