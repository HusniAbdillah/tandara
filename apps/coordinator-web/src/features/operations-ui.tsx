import { useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  reportPageSchema,
  reportDetailSchema,
  reportAnalyticsSchema,
  teamMemberSchema,
  workflowDetailSchema,
  workflowLabels,
} from '@tandara/contracts';
import type { Report, WorkflowAction } from '@tandara/contracts';
import { Badge, Button, Empty, Field, Icon, Notice, formatTime } from '@tandara/ui';
import type { ManagementProps } from './posko-app.js';
import { categories, ok } from './reports-ui.js';

const priorityLabels = { normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };
export function WorkflowBadge({ report }: { report: Report }) {
  const state = report.workflow?.status ?? 'received';
  return (
    <Badge
      tone={
        ['closed', 'resolved'].includes(state)
          ? 'teal'
          : state === 'rejected'
            ? 'red'
            : ['received', 'awaiting_approval', 'needs_information'].includes(state)
              ? 'amber'
              : 'neutral'
      }
    >
      {workflowLabels[state]}
    </Badge>
  );
}
function QueryFailure({ retry }: { retry: () => void }) {
  return (
    <Notice tone="error">
      Data belum dapat dimuat. Periksa koneksi Anda.{' '}
      <Button variant="outline" onClick={retry}>
        Coba lagi
      </Button>
    </Notice>
  );
}
function ReportRows({ reports }: { reports: Report[] }) {
  return (
    <div className="p-report-list">
      {reports.map((r) => (
        <Link to={'/reports/' + r.id} className="p-report-row" key={r.id}>
          <div className="p-report-description">
            <small>
              #{r.id.slice(0, 8).toUpperCase()} · {categories[r.category]}
            </small>
            <strong>{r.description}</strong>
            <span>
              <Icon name="pin" size={14} />
              {r.landmarkText || 'Lokasi belum dilengkapi'}
            </span>
          </div>
          <div>
            <WorkflowBadge report={r} />
            <small>{formatTime(r.createdAt)}</small>
          </div>
          <div className="p-report-owner">
            <strong>{r.workflow?.assigneeName ?? 'Belum ditugaskan'}</strong>
            <span className={r.workflow?.priority === 'urgent' ? 'p-urgent' : ''}>
              {priorityLabels[r.workflow?.priority ?? 'normal']}
            </span>
          </div>
          <Icon name="arrow" size={18} />
        </Link>
      ))}
    </div>
  );
}
function useAnalytics({ region, user }: Pick<ManagementProps, 'region' | 'user'>) {
  return useQuery({
    queryKey: ['report-analytics', user.id, region.id],
    queryFn: () => request(`/regions/${region.id}/report-analytics`, reportAnalyticsSchema),
    refetchInterval: 30000,
  });
}
function useTeam({ region, user }: Pick<ManagementProps, 'region' | 'user'>) {
  return useQuery({
    queryKey: ['team', user.id, region.id],
    queryFn: () => request(`/regions/${region.id}/team`, z.array(teamMemberSchema)),
  });
}
export function OperationsOverview(props: ManagementProps) {
  const { region, user } = props,
    analytics = useAnalytics(props),
    team = useTeam(props);
  const reports = useQuery({
    queryKey: ['operational-reports', user.id, region.id],
    queryFn: () => request(`/regions/${region.id}/reports`, reportPageSchema),
    refetchInterval: 30000,
  });
  const d = analytics.data;
  const metrics = [
    ['Laporan baru', d?.byStatus['received'], 'received', 'inbox'],
    [
      'Sedang ditangani',
      d ? (d.byStatus['assigned'] ?? 0) + (d.byStatus['in_progress'] ?? 0) : undefined,
      'in_progress',
      'help',
    ],
    ['Perlu persetujuan', d?.byStatus['awaiting_approval'], 'awaiting_approval', 'shield'],
    ['Laporan selesai', d?.byStatus['closed'], 'closed', 'check'],
  ] as const;
  return (
    <div className="p-stack">
      <header className="p-page-heading">
        <div>
          <h1>Selamat datang, {user.name.split(' ')[0]}.</h1>
          <p>
            {user.role === 'admin'
              ? 'Pantau laporan warga dan tinjau hasil penanganan.'
              : 'Kelola laporan wilayah dan sampaikan perkembangan kepada warga.'}
          </p>
        </div>
        <span className="p-date">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </header>
      {analytics.isError && <QueryFailure retry={() => void analytics.refetch()} />}
      <div className="p-metrics">
        {metrics.map(([label, value, status, icon]) => (
          <Link to={'/inbox?status=' + status} className="p-metric" key={label}>
            <span className="p-metric-icon">
              <Icon name={icon} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{d ? (value ?? 0) : '—'}</strong>
            </div>
          </Link>
        ))}
      </div>
      <div className="p-columns">
        <section className="p-card">
          <div className="p-card-heading">
            <div>
              <h2>Laporan masuk</h2>
              <p>{region.name}</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/inbox">Lihat semua</Link>
            </Button>
          </div>
          {reports.isPending ? (
            <p className="p-loading">Memuat laporan…</p>
          ) : reports.isError ? (
            <QueryFailure retry={() => void reports.refetch()} />
          ) : reports.data.items.length ? (
            <ReportRows reports={reports.data.items.slice(0, 6)} />
          ) : (
            <Empty title="Belum ada laporan">Laporan yang dikirim warga akan tampil di sini.</Empty>
          )}
        </section>
        <aside className="p-stack">
          <section className="p-card p-card-pad">
            <h2>Perlu perhatian</h2>
            <Link className="p-attention" to="/inbox?status=verified">
              <Icon name="inbox" />
              <span>
                Belum ditugaskan<strong>{d?.unassigned ?? '—'} laporan</strong>
              </span>
              <Icon name="arrow" size={16} />
            </Link>
            <Link className="p-attention" to="/inbox?status=awaiting_approval">
              <Icon name="shield" />
              <span>
                Menunggu tinjauan hasil
                <strong>{d?.byStatus['awaiting_approval'] ?? 0} laporan</strong>
              </span>
              <Icon name="arrow" size={16} />
            </Link>
            <p className="p-muted">{d?.urgent ?? 0} laporan aktif ditandai mendesak.</p>
          </section>
          <section className="p-card p-card-pad">
            <h2>Koordinator wilayah</h2>
            {team.isError ? (
              <QueryFailure retry={() => void team.refetch()} />
            ) : team.data?.length ? (
              team.data.map((m) => (
                <div className="p-team-row" key={m.id}>
                  <span className="p-avatar">{m.name.slice(0, 1)}</span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.activeReports} laporan aktif</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-muted">Belum ada koordinator yang ditugaskan.</p>
            )}
            {user.role === 'admin' && (
              <Button asChild variant="outline">
                <Link to="/members">Kelola anggota</Link>
              </Button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
export function OperationsInbox({ region, user }: ManagementProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const status =
      params.get('status') ?? (location.pathname === '/review' ? 'awaiting_approval' : ''),
    q = params.get('q') ?? '',
    category = params.get('category') ?? '',
    mine = params.get('mine') === 'true',
    page = Number(params.get('page') ?? 1);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  const queryString = new URLSearchParams({
    page: String(Number.isFinite(page) ? page : 1),
    q,
    ...(status ? { workflow: status } : {}),
    ...(category ? { category } : {}),
    ...(mine ? { mine: 'true' } : {}),
  });
  const reports = useQuery({
    queryKey: ['operations-inbox', user.id, region.id, queryString.toString()],
    queryFn: () => request(`/regions/${region.id}/reports?${queryString}`, reportPageSchema),
    refetchInterval: 30000,
  });
  return (
    <div className="p-stack">
      <header className="p-page-heading">
        <div>
          <h1>{status === 'awaiting_approval' ? 'Tinjau hasil penanganan' : 'Laporan warga'}</h1>
          <p>Verifikasi informasi, atur penugasan, dan ikuti perkembangan laporan.</p>
        </div>
        <Badge>{reports.data?.total ?? '—'} laporan</Badge>
      </header>
      <section className="p-card">
        <div className="p-filters">
          <Field label="Cari laporan">
            <input
              type="search"
              placeholder="Cari isi laporan atau lokasi…"
              value={q}
              onChange={(e) => update('q', e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => update('status', e.target.value)}>
              <option value="">Semua status</option>
              {Object.entries(workflowLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kategori">
            <select value={category} onChange={(e) => update('category', e.target.value)}>
              <option value="">Semua kategori</option>
              {Object.entries(categories).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {user.role === 'coordinator' && (
          <label className="p-check">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => update('mine', e.target.checked ? 'true' : '')}
            />
            Hanya penugasan saya
          </label>
        )}
        {reports.isPending ? (
          <p className="p-loading" role="status">
            Memuat laporan…
          </p>
        ) : reports.isError ? (
          <QueryFailure retry={() => void reports.refetch()} />
        ) : reports.data.items.length ? (
          <ReportRows reports={reports.data.items} />
        ) : (
          <div className="p-card-pad">
            <Empty title="Tidak ada laporan yang cocok">
              Ubah pencarian atau filter untuk melihat laporan lainnya.
            </Empty>
            <Button variant="outline" onClick={() => setParams({})}>
              Hapus filter
            </Button>
          </div>
        )}
        <div className="p-pagination">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('page', String(page - 1));
              setParams(next);
            }}
          >
            Sebelumnya
          </Button>
          <span>Halaman {page}</span>
          <Button
            variant="outline"
            disabled={!reports.data || page * 20 >= reports.data.total}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('page', String(page + 1));
              setParams(next);
            }}
          >
            Berikutnya
          </Button>
        </div>
      </section>
    </div>
  );
}

const actionLabels: Record<WorkflowAction['action'], string> = {
  verify: 'Verifikasi laporan',
  request_information: 'Minta informasi warga',
  reject: 'Tolak laporan',
  assign: 'Simpan penugasan',
  start: 'Mulai penanganan',
  update: 'Kirim perkembangan',
  submit_resolution: 'Ajukan penyelesaian',
  approve: 'Setujui penyelesaian',
  return: 'Kembalikan ke koordinator',
};
export function OperationsDetail({ id, region, user, run }: ManagementProps & { id: string }) {
  const detail = useQuery({
    queryKey: ['report', user.id, id],
    queryFn: () => request('/reports/' + id, reportDetailSchema),
    refetchInterval: 30000,
  });
  const activity = useQuery({
    queryKey: ['workflow', user.id, id],
    queryFn: () => request('/reports/' + id + '/workflow', workflowDetailSchema),
    refetchInterval: 30000,
  });
  const team = useTeam({
    region: { ...region, id: detail.data?.report.regionId ?? region.id },
    user,
  });
  const [action, setAction] = useState<WorkflowAction['action']>('verify'),
    [message, setMessage] = useState(''),
    [assignee, setAssignee] = useState(''),
    [priority, setPriority] = useState('normal'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!detail.data && detail.isPending) return <p role="status">Memuat laporan…</p>;
  if (!detail.data)
    return (
      <>
        <QueryFailure retry={() => void detail.refetch()} />
        <Link to="/inbox">Kembali ke laporan</Link>
      </>
    );
  const d = detail.data,
    r = d.report,
    w = activity.data?.workflow ?? r.workflow;
  const state = w?.status ?? 'received',
    admin = user.role === 'admin',
    own = w?.assigneeId === user.id;
  const actions: WorkflowAction['action'][] = [];
  if (['received', 'needs_information'].includes(state)) actions.push('verify');
  if (['received', 'verified', 'assigned', 'in_progress'].includes(state))
    actions.push('request_information');
  if (admin && ['received', 'needs_information', 'verified'].includes(state))
    actions.push('reject');
  if (admin && ['verified', 'assigned', 'in_progress'].includes(state)) actions.push('assign');
  if (own && state === 'assigned') actions.push('start');
  if (own && state === 'in_progress') actions.push('update', 'submit_resolution');
  if (admin && state === 'awaiting_approval') actions.push('approve', 'return');
  const selected = actions.includes(action) ? action : actions[0];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !w) return;
    setBusy(true);
    setError('');
    try {
      await run(
        () =>
          request('/reports/' + id + '/workflow', ok, {
            method: 'POST',
            body: {
              action: selected,
              message,
              revision: w.revision,
              ...(selected === 'assign' ? { assigneeId: assignee, priority } : {}),
            },
          }),
        'Pembaruan tersimpan dan tersedia untuk warga.',
      );
      setMessage('');
      await Promise.all([activity.refetch(), detail.refetch()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pembaruan gagal.');
      await activity.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-stack">
      <Link className="p-back" to="/inbox">
        ← Kembali ke laporan
      </Link>
      <header className="p-page-heading">
        <div>
          <h1>Laporan #{id.slice(0, 8).toUpperCase()}</h1>
          <p>{r.landmarkText || categories[r.category]}</p>
        </div>
        <WorkflowBadge report={{ ...r, ...(w ? { workflow: w } : {}) }} />
      </header>
      {(detail.isError || activity.isError) && (
        <Notice tone="warning">
          Pembaruan otomatis gagal. Isian tetap tersimpan.{' '}
          <Button onClick={() => void Promise.all([detail.refetch(), activity.refetch()])}>
            Muat status terbaru
          </Button>
        </Notice>
      )}
      <div className="p-detail-columns">
        <div className="p-stack">
          <section className="p-card p-card-pad">
            <div className="p-card-heading">
              <h2>Informasi dari warga</h2>
              <Badge>{categories[r.category]}</Badge>
            </div>
            <p className="p-original">{r.description}</p>
            <dl className="p-description">
              <dt>Lokasi</dt>
              <dd>{r.landmarkText || 'Belum diberikan'}</dd>
              <dt>Diterima</dt>
              <dd>{formatTime(r.createdAt)}</dd>
              <dt>Diamati</dt>
              <dd>{formatTime(r.observationTime)}</dd>
              <dt>Koordinator</dt>
              <dd>{w?.assigneeName ?? 'Belum ditugaskan'}</dd>
              <dt>Prioritas</dt>
              <dd>{priorityLabels[w?.priority ?? 'normal']}</dd>
              {d.reporterPhone && (
                <>
                  <dt>Nomor telepon pelapor</dt>
                  <dd>
                    <a href={'tel:' + d.reporterPhone}>{d.reporterPhone}</a>
                  </dd>
                </>
              )}
              {r.contactDetails && (
                <>
                  <dt>Kontak warga</dt>
                  <dd>{r.contactDetails}</dd>
                </>
              )}
            </dl>
            {r.followUpRequested && (
              <Notice>
                Warga meminta tindak lanjut. Data kontak hanya tersedia bagi petugas wilayah.
              </Notice>
            )}
            {d.attachments.length > 0 && (
              <div className="p-attachments">
                {d.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/v1/reports/${id}/attachments/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={`/api/v1/reports/${id}/attachments/${a.id}`}
                      alt={a.name}
                      loading="lazy"
                    />
                    <span>{a.name}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
          <section className="p-card p-card-pad">
            <h2>Perjalanan laporan</h2>
            <ol className="p-timeline">
              <li>
                <span className="p-timeline-dot" />
                <div>
                  <strong>Laporan diterima</strong>
                  <p>Warga mengirim laporan ke Posko.</p>
                  <small>{formatTime(r.createdAt)}</small>
                </div>
              </li>
              {activity.data?.events.map((event) => (
                <li key={event.id}>
                  <span className="p-timeline-dot" />
                  <div>
                    <strong>
                      {workflowLabels[event.action as keyof typeof workflowLabels] ?? event.action}
                    </strong>
                    <p>{event.message}</p>
                    <small>
                      {event.actor ?? 'Warga'} · {formatTime(event.createdAt)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="p-stack">
          <section className="p-card p-card-pad">
            <h2>{selected ? 'Tindak lanjut laporan' : 'Status penanganan'}</h2>
            {selected ? (
              <form onSubmit={(e) => void submit(e)}>
                <Field label="Tindakan">
                  <select
                    value={selected}
                    onChange={(e) => setAction(e.target.value as WorkflowAction['action'])}
                  >
                    {actions.map((a) => (
                      <option key={a} value={a}>
                        {actionLabels[a]}
                      </option>
                    ))}
                  </select>
                </Field>
                {selected === 'assign' && (
                  <>
                    <Field label="Koordinator penanggung jawab">
                      <select
                        required
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                      >
                        <option value="">Pilih koordinator</option>
                        {team.data
                          ?.filter((m) => m.role === 'coordinator')
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.activeReports} aktif
                            </option>
                          ))}
                      </select>
                    </Field>
                    {team.isError && <QueryFailure retry={() => void team.refetch()} />}
                    <Field label="Prioritas">
                      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                        {Object.entries(priorityLabels).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                <Field
                  label={
                    selected === 'submit_resolution'
                      ? 'Hasil penanganan'
                      : selected === 'reject'
                        ? 'Alasan penolakan'
                        : 'Pesan untuk warga'
                  }
                  hint="Pesan ini dapat dibaca warga melalui status laporan. Jangan sertakan data pribadi."
                >
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Jelaskan hasil pemeriksaan atau langkah berikutnya…"
                  />
                </Field>
                {selected === 'approve' && (
                  <Notice>
                    Warga akan diminta mengonfirmasi hasil. Laporan ditutup setelah warga menyatakan
                    masalah selesai.
                  </Notice>
                )}
                {error && <Notice tone="error">{error}</Notice>}
                <Button className="p-full" disabled={busy || !w || activity.isError} type="submit">
                  {busy ? 'Menyimpan…' : actionLabels[selected]}
                </Button>
              </form>
            ) : (
              <p>
                {state === 'resolved'
                  ? 'Hasil telah disetujui. Menunggu konfirmasi atau tanggapan warga.'
                  : state === 'closed'
                    ? 'Warga telah mengonfirmasi penyelesaian laporan.'
                    : state === 'rejected'
                      ? 'Laporan ditolak. Alasan dapat dibaca warga pada riwayat laporan.'
                      : 'Penanganan dilanjutkan oleh petugas yang ditugaskan.'}
              </p>
            )}
          </section>
          <section className="p-card p-card-pad">
            <h3>Alur penanganan</h3>
            <p className="p-muted">
              Verifikasi → penugasan → penanganan → persetujuan Admin → konfirmasi warga.
            </p>
            <p className="p-muted">
              Jika masalah belum selesai, warga dapat mengembalikan laporan untuk ditangani kembali.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function AnalyticsPage(props: ManagementProps) {
  const query = useAnalytics(props),
    d = query.data;
  const exportCsv = () => {
    if (!d) return;
    const rows = [
      ['Status', 'Jumlah'],
      ...Object.entries(workflowLabels).map(([s, label]) => [label, String(d.byStatus[s] ?? 0)]),
    ];
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'rekap-laporan.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="p-stack">
      <header className="p-page-heading">
        <div>
          <h1>Rekap laporan</h1>
          <p>Seluruh laporan {props.region.name}. Tren harian mencakup 30 hari terakhir.</p>
        </div>
        <Button variant="outline" disabled={!d} onClick={exportCsv}>
          <Icon name="download" />
          Unduh rekap
        </Button>
      </header>
      {query.isError ? (
        <QueryFailure retry={() => void query.refetch()} />
      ) : !d ? (
        <p role="status">Menghitung rekap…</p>
      ) : (
        <>
          <div className="p-metrics">
            {[
              ['Total laporan', d.total],
              ['Belum ditugaskan', d.unassigned],
              ['Prioritas mendesak', d.urgent],
              [
                'Penilaian warga',
                d.averageRating ? d.averageRating.toFixed(1) + ' / 5' : 'Belum ada',
              ],
            ].map(([label, value]) => (
              <div className="p-metric" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className="p-equal-columns">
            <section className="p-card p-card-pad">
              <h2>Status penanganan</h2>
              {Object.entries(workflowLabels).map(([key, label]) => (
                <Link className="p-chart-row" to={'/inbox?status=' + key} key={key}>
                  <span>{label}</span>
                  <strong>{d.byStatus[key] ?? 0}</strong>
                  <meter min={0} max={Math.max(1, d.total)} value={d.byStatus[key] ?? 0}>
                    {d.byStatus[key] ?? 0}
                  </meter>
                </Link>
              ))}
            </section>
            <section className="p-card p-card-pad">
              <h2>Jenis laporan</h2>
              {Object.entries(categories).map(([key, label]) => (
                <div className="p-chart-row" key={key}>
                  <span>{label}</span>
                  <strong>{d.byCategory[key] ?? 0}</strong>
                  <meter min={0} max={Math.max(1, d.total)} value={d.byCategory[key] ?? 0}>
                    {d.byCategory[key] ?? 0}
                  </meter>
                </div>
              ))}
              <p className="p-muted">Penilaian berasal dari {d.feedbackCount} konfirmasi warga.</p>
            </section>
          </div>
          <section className="p-card p-card-pad">
            <h2>Laporan masuk · 30 hari terakhir</h2>
            {d.daily.length ? (
              <div className="p-daily">
                {d.daily.map((day) => (
                  <div key={day.day}>
                    <span>{day.day}</span>
                    <meter
                      min={0}
                      max={Math.max(...d.daily.map((x) => x.count), 1)}
                      value={day.count}
                    >
                      {day.count}
                    </meter>
                    <strong>{day.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Belum ada laporan baru">
                Grafik akan terisi saat warga mengirim laporan.
              </Empty>
            )}
          </section>
        </>
      )}
    </div>
  );
}
export function TeamPage(props: ManagementProps) {
  const team = useTeam(props);
  return (
    <div className="p-stack">
      <header className="p-page-heading">
        <div>
          <h1>Tim wilayah</h1>
          <p>Koordinator dengan akses ke {props.region.name}.</p>
        </div>
      </header>
      <section className="p-card p-card-pad">
        {team.isError ? (
          <QueryFailure retry={() => void team.refetch()} />
        ) : team.isPending ? (
          <p>Memuat tim…</p>
        ) : team.data.length ? (
          team.data.map((m) => (
            <div className="p-team-row" key={m.id}>
              <span className="p-avatar">{m.name[0]}</span>
              <div>
                <strong>{m.name}</strong>
                <small>
                  {m.role === 'admin' ? 'Admin' : 'Koordinator'} · {m.activeReports} laporan aktif
                </small>
              </div>
            </div>
          ))
        ) : (
          <Empty title="Belum ada anggota">
            Admin dapat menambahkan koordinator dan akses wilayah.
          </Empty>
        )}
      </section>
      <Notice>Perubahan anggota, peran, dan cakupan wilayah dikelola oleh Admin.</Notice>
    </div>
  );
}
