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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="mb-1 text-[30px] leading-10 font-bold tracking-[-0.6px]">Ringkasan</h1>
          <p className="mb-0 text-sm text-muted-foreground">{region.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/training">Kelola latihan</Link>
          </Button>
          <Button asChild>
            <Link to="/inbox">
              Buka kotak laporan <Icon name="arrow" size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Laporan tercatat"
          value={reports.data?.total ?? '—'}
          note="Semua laporan warga"
          href="/inbox"
          tone="neutral"
        />
        <MetricCard
          label="Menunggu tinjauan"
          value={pending.data?.total ?? '—'}
          note="Laporan baru"
          href="/inbox"
          tone="amber"
        />
        <MetricCard
          label="Tindak lanjut terbuka"
          value={assistance.data?.filter((a) => a.state !== 'closed').length ?? '—'}
          note="Permintaan bantuan"
          href="/assistance"
          tone="teal"
        />
        <MetricCard
          label="Sumber bermasalah"
          value={sources.data?.filter((s) => s.enabled && s.lastError).length ?? '—'}
          note="Sumber aktif dengan kendala"
          href="/sources"
          tone={sources.data?.some((s) => s.enabled && s.lastError) ? 'amber' : 'neutral'}
        />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.85fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <CardTitle className="text-lg">Laporan terbaru</CardTitle>
              <p className="mb-0 mt-1 text-xs text-muted-foreground">
                Laporan warga · {region.name}
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
        <aside>
          <Card className="overflow-hidden">
            <CardHeader className="gap-1 px-5 pt-5 pb-2">
              <p className="mb-0.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                RINGKASAN · 24 JAM
              </p>
              <CardTitle className="text-[17px]">Informasi terkini</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 text-sm">
              {summary.isPending ? (
                <div
                  className="h-12 animate-pulse rounded bg-[#f0f3f0]"
                  role="status"
                  aria-label="Memuat ringkasan"
                />
              ) : summary.isError ? (
                <Notice tone="error">Ringkasan belum dapat dimuat.</Notice>
              ) : (
                <p className="mb-0 border-l-2 border-brand bg-paper px-3.5 py-3 leading-relaxed">
                  {summary.data?.summary ?? 'Ringkasan belum tersedia.'}
                </p>
              )}
              {summary.data && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium text-muted-foreground">Perlu tinjauan manusia</span>
                  <time className="font-mono text-[11px] text-muted-foreground">
                    {formatTime(summary.data.generatedAt)}
                  </time>
                </div>
              )}
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
              <div className="border-t border-line pt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="mb-0 text-sm font-semibold">Sumber informasi</p>
                  <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                    <Link to="/sources">Kelola</Link>
                  </Button>
                </div>
                {sources.isPending ? (
                  <p className="mb-0 text-xs text-muted-foreground">Memuat status sumber…</p>
                ) : sources.isError ? (
                  <p className="mb-0 text-xs text-red">Status sumber tidak dapat dimuat.</p>
                ) : sources.data?.length ? (
                  <ul className="m-0 list-none divide-y divide-line p-0">
                    {sources.data.slice(0, 3).map((source) => (
                      <li
                        key={source.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-1"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">{source.name}</span>
                        {source.mode === 'simulation' && source.enabled && !source.lastError ? (
                          <Badge
                            tone="neutral"
                            className="border-dashed border-[#a23b72] bg-[#f8e6ef] text-[#a23b72]"
                          >
                            Simulasi
                          </Badge>
                        ) : (
                          <Badge
                            tone={source.lastError ? 'amber' : source.enabled ? 'teal' : 'neutral'}
                          >
                            {source.enabled
                              ? source.lastError
                                ? 'Perlu cek'
                                : 'Aktif'
                              : 'Nonaktif'}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-0 text-xs text-muted-foreground">Belum ada sumber informasi.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
function MetricCard({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  note: string;
  href: string;
  tone: 'neutral' | 'teal' | 'amber';
}) {
  const valueTone = {
    neutral: 'text-ink',
    teal: 'text-brand',
    amber: 'text-[#8a5a0c]',
  }[tone];
  return (
    <Card className="min-w-0 transition-colors hover:border-[#7fb3b8]">
      <CardContent className="px-5 py-4">
        <p className="mb-2 truncate font-mono text-[11px] leading-4 font-medium tracking-[0.04em] text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={`mb-2 font-sans text-[34px] leading-10 font-semibold tabular-nums tracking-[-0.68px] ${valueTone}`}
        >
          {value}
        </p>
        <Link
          className="text-xs text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
          to={href}
        >
          {note}
        </Link>
      </CardContent>
    </Card>
  );
}
function ReportTable({ reports }: { reports: Report[] }) {
  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="bg-paper hover:bg-paper">
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
              <span className="text-sm text-muted-foreground">
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
            <TableCell className="whitespace-nowrap">
              <Badge
                tone={r.state === 'reviewed' ? 'teal' : r.state === 'rejected' ? 'red' : 'amber'}
              >
                {statuses[r.state]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
              <span className="text-ink">{formatTime(r.createdAt)}</span>
              <div className="mt-1 font-sans text-xs text-muted-foreground">
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
          <Select
            value={state || 'all'}
            onValueChange={(value) => {
              setState(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Status laporan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              {Object.entries(statuses).map(([s, l]) => (
                <SelectItem key={s} value={s}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="field">
          Jenis
          <Select
            value={category || 'all'}
            onValueChange={(value) => {
              setCategory(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Jenis laporan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua jenis</SelectItem>
              {region.config.categories.map((c) => (
                <SelectItem value={c} key={c}>
                  {categories[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="field">
          Urutan
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Urutkan laporan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Terbaru</SelectItem>
              <SelectItem value="oldest">Terlama</SelectItem>
            </SelectContent>
          </Select>
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
      <div className="breadcrumb mb-3 flex items-center gap-2 text-xs">
        <Link to="/inbox">Kotak laporan</Link> / {id.slice(0, 8)}
      </div>
      <PageHeader
        eyebrow="Detail laporan warga"
        title={'Laporan #' + id.slice(0, 8)}
        description={r.landmarkText || 'Lokasi belum cukup jelas'}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{categories[r.category] ?? r.category}</Badge>
            <Badge tone={r.state === 'reviewed' ? 'teal' : 'amber'}>{statuses[r.state]}</Badge>
          </div>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="split mt-6 grid items-start gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="panel m-0 rounded-lg border-[#e3dfd6] p-5 sm:p-6">
          <div className="panel-heading mb-4 border-b border-line pb-3">
            <h2 className="mb-0 text-lg">Laporan asli</h2>
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
            {d.reporterPhone && (
              <span>
                Nomor telepon pelapor: <a href={'tel:' + d.reporterPhone}>{d.reporterPhone}</a>
              </span>
            )}
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
              <h3>Foto laporan</h3>
              <div className="p-attachments">
                {d.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={'/api/v1/reports/' + id + '/attachments/' + a.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={'/api/v1/reports/' + id + '/attachments/' + a.id}
                      alt={a.name}
                      loading="lazy"
                    />
                    <span>
                      {a.name} · {formatTime(a.createdAt)}
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="panel m-0 rounded-lg border-dashed border-[#b8c5c4] bg-white p-5 sm:p-6">
          <p className="eyebrow mb-3">Saran pendukung / Perlu tinjauan manusia</p>
          <div className="panel-heading mb-3">
            <h2 className="mb-0 text-lg">Asisten triase</h2>
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
      <div className="split mt-5 grid items-start gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="panel m-0 rounded-lg border-[#e3dfd6] p-5 sm:p-6">
          <h2 className="mb-2 text-lg">Keputusan koordinator</h2>
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
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger aria-label="Status tujuan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statuses)
                      .filter(([s]) => s !== r.state && s !== 'submitted')
                      .map(([s, l]) => (
                        <SelectItem value={s} key={s}>
                          {l}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Koreksi kategori (opsional)">
                <Select
                  value={category || 'keep'}
                  onValueChange={(value) => setCategory(value === 'keep' ? '' : value)}
                >
                  <SelectTrigger aria-label="Koreksi kategori">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Pertahankan kategori</SelectItem>
                    {region.config.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categories[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <section className="panel m-0 rounded-lg border-[#e3dfd6] p-5 sm:p-6">
          <h2 className="mb-4 text-lg">Riwayat & tanggung jawab</h2>
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
