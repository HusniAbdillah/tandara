import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { aiOperationsSchema, aiRunSchema, aiTaskSchema, type AiRun } from '@tandara/contracts';
import { Badge, Empty, Field, Notice, PageHeader, formatTime } from '@tandara/ui';
import type { ManagementProps } from './posko-app.js';
import { KnowledgeManagement } from './knowledge-ui.js';

const ok = z.object({ ok: z.boolean() });
const taskNames: Record<string, string> = {
  duplicates: 'Penjelasan kandidat duplikat',
  briefing: 'Briefing wilayah',
  answer: 'Tanya rencana disetujui',
  clarification: 'Draf klarifikasi',
  public_summary: 'Draf ringkasan publik',
  plan_draft: 'Draf perubahan rencana',
  training_draft: 'Draf materi latihan',
  translation: 'Saran terjemahan',
  coverage: 'Penjelasan cakupan laporan',
};
const states: Record<string, string> = {
  queued: 'Dalam antrean',
  processing: 'Sedang diproses',
  ready: 'Perlu tinjauan',
  failed: 'Gagal diproses',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
  unavailable: 'Sumber tidak berlaku',
};
export function AiWorkspace({ region, user, run }: ManagementProps) {
  const [task, setTask] = useState<z.infer<typeof aiTaskSchema>>('briefing');
  const [question, setQuestion] = useState('');
  const [reportId, setReportId] = useState('');
  const [hours, setHours] = useState(24);
  const [language, setLanguage] = useState('id');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['ai-runs', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/ai/runs', z.array(aiRunSchema)),
    refetchInterval: 5000,
  });
  const reports = useQuery({
    queryKey: ['ai-report-options', user.id, region.id],
    queryFn: () =>
      request(
        '/regions/' + region.id + '/reports',
        z.object({ items: z.array(z.object({ id: z.uuid(), description: z.string() })) }),
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow="ASISTEN POSKO"
        title="Bantuan berbasis sumber"
        description="Petikan, pertanyaan, dan draf untuk keputusan koordinator. Semua hasil memerlukan tinjauan."
      />
      <div className="ai-workspace-grid">
        <section className="panel">
          <h2>Buat permintaan</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await run(
                  () =>
                    request('/regions/' + region.id + '/ai/runs', z.object({ id: z.uuid() }), {
                      method: 'POST',
                      body: {
                        task,
                        requestKey: crypto.randomUUID(),
                        hours,
                        language,
                        ...(question.trim() ? { question } : {}),
                        ...(['duplicates', 'clarification', 'public_summary'].includes(task)
                          ? { reportId }
                          : {}),
                      },
                    }),
                  'Permintaan masuk antrean.',
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Permintaan gagal.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Jenis bantuan">
              <select value={task} onChange={(e) => setTask(aiTaskSchema.parse(e.target.value))}>
                {Object.entries(taskNames).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {['duplicates', 'clarification', 'public_summary'].includes(task) && (
              <Field label="Laporan sumber">
                <select required value={reportId} onChange={(e) => setReportId(e.target.value)}>
                  <option value="">Pilih laporan</option>
                  {reports.data?.items.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.description.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {['answer', 'translation', 'plan_draft', 'training_draft'].includes(task) && (
              <Field
                label={task === 'translation' ? 'Teks asli' : 'Pertanyaan atau kebutuhan draf'}
              >
                <textarea
                  required
                  minLength={3}
                  maxLength={1500}
                  rows={5}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </Field>
            )}
            {task === 'briefing' && (
              <Field label="Rentang laporan">
                <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {[6, 24, 48, 168].map((h) => (
                    <option value={h} key={h}>
                      {h} jam terakhir
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {task === 'translation' && (
              <Field label="Bahasa tujuan">
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {region.config.languages.map((l) => (
                    <option value={l} key={l}>
                      {{ id: 'Indonesia', jv: 'Jawa', su: 'Sunda' }[l]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Notice>
              Gunakan teks seperlunya. Identitas, kontak, foto, dan koordinat rinci tidak diperlukan
              dalam permintaan.
            </Notice>
            {error && <Notice tone="error">{error}</Notice>}
            <button className="primary" disabled={busy}>
              {busy ? 'Mengirim…' : 'Buat draf bantuan'}
            </button>
          </form>
        </section>
        <section>
          <h2>Permintaan dan hasil</h2>
          {query.isPending ? (
            <p role="status">Memuat permintaan…</p>
          ) : query.isError ? (
            <Notice tone="error">Permintaan tidak dapat dimuat.</Notice>
          ) : query.data?.length ? (
            query.data.map((item) => (
              <AiResult key={item.id} item={item} regionId={region.id} run={run} />
            ))
          ) : (
            <Empty title="Belum ada permintaan">
              Buat briefing atau pertanyaan dari formulir di samping.
            </Empty>
          )}
        </section>
      </div>
      <KnowledgeManagement region={region} user={user} run={run} />
      {user.role === 'admin' && <AiOperations region={region} user={user} run={run} />}
    </>
  );
}
function AiResult({
  item,
  regionId,
  run,
}: {
  item: AiRun;
  regionId: string;
  run: ManagementProps['run'];
}) {
  const [note, setNote] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedText, setEditedText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = item.reviews[0];
  const output = latest?.output ?? item.output;
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await run(action);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan gagal.');
    } finally {
      setBusy(false);
    }
  }
  const base = '/regions/' + regionId + '/ai/runs/' + item.id;
  return (
    <article id={'ai-run-' + item.id} className="panel ai-result">
      <div className="actions">
        <Badge tone={item.state === 'ready' ? 'amber' : 'neutral'}>
          {states[item.state] ?? item.state}
        </Badge>
        <span className="meta">{formatTime(item.createdAt)}</span>
      </div>
      <h3>{taskNames[item.task]}</h3>
      {item.error && <Notice tone="warning">Hasil tidak tersedia: {item.error}</Notice>}
      {output && (
        <>
          <h4>{output.title}</h4>
          {output.abstained && (
            <Notice tone="warning">Sumber belum cukup untuk menjawab permintaan.</Notice>
          )}
          {output.claims.map((claim, i) => (
            <div className="ai-claim" key={i}>
              <p>{claim.text}</p>
              <span className="meta">
                {
                  {
                    explicit: 'Tersurat dalam sumber',
                    ambiguous: 'Masih ambigu',
                    contradicted: 'Sumber bertentangan',
                    insufficient_evidence: 'Bukti belum cukup',
                  }[claim.state]
                }
              </span>
              {claim.citations.map((c, j) => {
                const source = item.sources.find((s) => s.id === c.sourceId);
                return source ? (
                  <details key={j}>
                    <summary>
                      Sumber: {source.title} · versi {source.version}
                    </summary>
                    <blockquote>{c.quote}</blockquote>
                    {source.kind === 'plan' ? (
                      <Link to="/plans">Buka rencana lokal</Link>
                    ) : source.kind === 'report' ? (
                      <Link to={'/reports/' + source.entityId}>Buka laporan asli</Link>
                    ) : null}
                  </details>
                ) : null;
              })}
            </div>
          ))}
          {!!output.questions.length && (
            <>
              <h4>Pertanyaan untuk ditinjau</h4>
              <ul>
                {output.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          )}
          {output.draft && (
            <>
              <Badge tone="amber">Draf {taskNames[output.draft.kind]}</Badge>
              {output.draft.sections.map((s, i) => (
                <section key={i}>
                  <h4>{s.heading}</h4>
                  <p>{s.text}</p>
                  {s.citations.map((c, j) => (
                    <details key={j}>
                      <summary>Petikan pendukung</summary>
                      <blockquote>{c.quote}</blockquote>
                    </details>
                  ))}
                </section>
              ))}
            </>
          )}
          {output.translation !== null && (
            <div className="ai-translation">
              <section>
                <h4>Teks asli</h4>
                <p>{item.sources.find((s) => s.kind === 'instruction')?.text}</p>
              </section>
              <section>
                <h4>Saran terjemahan</h4>
                <p>{output.translation}</p>
                <Notice tone="warning">
                  Tinjauan penutur yang memenuhi kualifikasi diperlukan, terutama untuk arahan
                  penting.
                </Notice>
              </section>
            </div>
          )}
          <p className="meta">{output.limitation}</p>
          <details>
            <summary>Asal hasil dan riwayat</summary>
            <p>
              Model: {String(item.provenance['model'] ?? '—')} · Versi alur:{' '}
              {String(item.provenance['workflowVersion'] ?? '—')} · {item.sources.length} sumber
            </p>
            {item.reviews.map((r) => (
              <p key={r.id}>
                {{ accepted: 'Diterima sebagai draf', edited: 'Dikoreksi', rejected: 'Ditolak' }[
                  r.action
                ] ?? r.action}{' '}
                · {formatTime(r.createdAt)} · {r.note}
              </p>
            ))}
            {latest?.output && item.output && (
              <>
                <h4>Hasil model asli</h4>
                <p>{item.output.title}</p>
                {item.output.claims.map((c, i) => (
                  <p key={i}>{c.text}</p>
                ))}
              </>
            )}
          </details>
          <form onSubmit={(e) => e.preventDefault()}>
            <Field label="Catatan keputusan">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                minLength={5}
                maxLength={1000}
                rows={2}
              />
            </Field>
            <details>
              <summary>Koreksi draf</summary>
              <Field label="Judul hasil koreksi">
                <input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field
                label={
                  output.translation !== null
                    ? 'Terjemahan hasil koreksi'
                    : 'Isi draf / pertanyaan hasil koreksi'
                }
              >
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  maxLength={output.translation !== null ? 6000 : 2000}
                  rows={4}
                />
              </Field>
              <button
                disabled={busy || note.trim().length < 5 || !editedTitle.trim()}
                onClick={() =>
                  void act(() =>
                    request(base + '/review', ok, {
                      method: 'POST',
                      body: {
                        action: 'edited',
                        note,
                        output: {
                          ...output,
                          title: editedTitle,
                          ...(editedText
                            ? output.translation !== null
                              ? { translation: editedText }
                              : output.draft
                                ? {
                                    draft: {
                                      ...output.draft,
                                      sections: output.draft.sections.map((s, i) =>
                                        i === 0 ? { ...s, text: editedText } : s,
                                      ),
                                    },
                                  }
                                : { questions: [editedText.slice(0, 500)] }
                            : {}),
                        },
                      },
                    }),
                  )
                }
              >
                Simpan koreksi
              </button>
            </details>
            <div className="actions">
              <button
                disabled={busy || note.trim().length < 5}
                onClick={() =>
                  void act(() =>
                    request(base + '/review', ok, {
                      method: 'POST',
                      body: { action: 'accepted', note },
                    }),
                  )
                }
              >
                Terima sebagai draf
              </button>
              <button
                disabled={busy || note.trim().length < 5}
                onClick={() =>
                  void act(() =>
                    request(base + '/review', ok, {
                      method: 'POST',
                      body: { action: 'rejected', note },
                    }),
                  )
                }
              >
                Tolak
              </button>
            </div>
            <p className="meta">
              Keputusan ini tidak menerbitkan, mengirim pesan, atau mengubah laporan maupun rencana.
            </p>
          </form>
        </>
      )}
      {['queued', 'processing', 'failed'].includes(item.state) && (
        <button
          disabled={busy}
          onClick={() => void act(() => request(base + '/cancel', ok, { method: 'POST' }))}
        >
          Batalkan permintaan
        </button>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {item.state === 'failed' && (
        <button
          disabled={busy}
          onClick={() =>
            void act(() => request(base + '/retry', z.object({ id: z.uuid() }), { method: 'POST' }))
          }
        >
          Ulangi sebagai permintaan baru
        </button>
      )}
    </article>
  );
}
function AiOperations({ user, run }: ManagementProps) {
  const query = useQuery({
    queryKey: ['ai-operations', user.id],
    queryFn: () => request('/admin/ai/operations', aiOperationsSchema),
    refetchInterval: 15000,
  });
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('global');
  const [scopeId, setScopeId] = useState('*');
  const [evaluationHash, setEvaluationHash] = useState('');
  const [error, setError] = useState('');
  async function act(fn: () => Promise<unknown>) {
    setError('');
    try {
      await run(fn);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan gagal.');
    }
  }
  const data = query.data;
  return (
    <section className="panel">
      <h2>Operasi AI</h2>
      {query.isError ? (
        <Notice tone="error">Operasi tidak dapat dimuat.</Notice>
      ) : !data ? (
        <p>Memuat operasi…</p>
      ) : (
        <>
          <p>
            Mode: {data.mode} · Provider: {data.provider} · Model: {data.model || 'aturan lokal'}
          </p>
          <div className="table-scroll">
            <table>
              <caption>Antrean per alur</caption>
              <thead>
                <tr>
                  <th>Alur</th>
                  <th>Status</th>
                  <th>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.task + r.state}>
                    <td>{taskNames[r.task] ?? r.task}</td>
                    <td>{states[r.state] ?? r.state}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-scroll">
            <table>
              <caption>Reservasi biaya konservatif (USD)</caption>
              <thead>
                <tr>
                  <th>Organisasi</th>
                  <th>Tanggal</th>
                  <th>Reservasi</th>
                  <th>Batas harian</th>
                </tr>
              </thead>
              <tbody>
                {data.budgets.map((b) => (
                  <tr key={b.organizationId + b.day}>
                    <td>{b.organizationId.slice(0, 8)}</td>
                    <td>{b.day}</td>
                    <td>{(b.reserved / 1000000).toFixed(3)}</td>
                    <td>{(b.limit / 1000000).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={(e) => e.preventDefault()}>
            <Field label="Lingkup kendali">
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setScopeId(e.target.value === 'global' ? '*' : '');
                }}
              >
                {['global', 'provider', 'task', 'organization', 'release'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Identitas lingkup">
              <input
                required
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="Alasan dan catatan persetujuan">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={10}
                maxLength={1000}
                rows={2}
              />
            </Field>
            <div className="actions">
              <button
                disabled={reason.trim().length < 10 || !scopeId}
                onClick={() =>
                  void act(() =>
                    request('/admin/ai/controls', ok, {
                      method: 'POST',
                      body: { scope, scopeId, enabled: false, reason },
                    }),
                  )
                }
              >
                Hentikan AI
              </button>
              <button
                disabled={reason.trim().length < 10 || !scopeId}
                onClick={() =>
                  void act(() =>
                    request('/admin/ai/controls', ok, {
                      method: 'POST',
                      body: { scope, scopeId, enabled: true, reason },
                    }),
                  )
                }
              >
                Aktifkan kembali
              </button>
            </div>
          </form>
          {data.controls.map((c) => (
            <p key={c.scope + c.scopeId}>
              {c.scope} / {c.scopeId}: {c.enabled ? 'aktif' : 'dihentikan'} — {c.reason}
            </p>
          ))}
          <h3>Rilis dan persetujuan evaluasi</h3>
          <Field label="SHA-256 laporan evaluasi yang ditinjau">
            <input
              value={evaluationHash}
              onChange={(e) => setEvaluationHash(e.target.value)}
              pattern="[a-f0-9]{64}"
              maxLength={64}
            />
          </Field>
          {data.releases.map((r) => (
            <details key={r.id}>
              <summary>
                {String(r.manifest['model'])} ·{' '}
                {r.approved ? 'disetujui' : 'menunggu dua persetujuan'} · {formatTime(r.createdAt)}
              </summary>
              <p>
                {String(r.manifest['provider'])} · {String(r.manifest['promptVersion'])} · {r.id}
              </p>
              <Field label="Daftarkan laporan evaluasi yang telah ditinjau">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void act(async () => {
                      const parsed = JSON.parse(await file.text()) as {
                        releaseReports?: Record<string, unknown>;
                        artifactHash?: string;
                      };
                      const group = String(r.manifest['promptVersion']).startsWith('triage-')
                        ? 'triage'
                        : 'assistance';
                      const report = parsed.releaseReports?.[group] ?? parsed;
                      await request(
                        '/admin/ai/releases/' + r.id + '/evaluations',
                        z.object({ id: z.uuid() }),
                        { method: 'POST', body: report },
                      );
                      if (parsed.artifactHash) setEvaluationHash(parsed.artifactHash);
                    });
                  }}
                />
              </Field>
              <div className="actions">
                <button
                  disabled={!/^[a-f0-9]{64}$/.test(evaluationHash) || reason.trim().length < 10}
                  onClick={() =>
                    void act(() =>
                      request('/admin/ai/releases/' + r.id + '/approve', ok, {
                        method: 'POST',
                        body: { evaluationHash, note: reason },
                      }),
                    )
                  }
                >
                  Catat persetujuan saya
                </button>
                <button
                  disabled={!r.approved}
                  onClick={() =>
                    void act(() =>
                      request('/admin/ai/releases/' + r.id + '/activate', ok, { method: 'POST' }),
                    )
                  }
                >
                  Gunakan rilis ini
                </button>
              </div>
            </details>
          ))}
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
