import { useEffect, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  createReportSchema,
  receiptSchema,
  trackingSchema,
  trainingSchema,
} from '@tandara/contracts';
import type { Region } from '@tandara/contracts';
import { Badge, Empty, Field, Icon, Notice, PageHeader, formatTime } from '@tandara/ui';
import { residentDb } from '../offline/database.js';
import type { Receipt, ReportDraft } from '../offline/database.js';
import { enqueue, synchronize } from '../offline/sync.js';

export const categoryNames: Record<string, string> = {
  road_flooding: 'Genangan di jalan',
  water_entering_homes: 'Air masuk rumah',
  blocked_access: 'Akses terhalang',
  debris: 'Material / sampah',
  damaged_facility: 'Fasilitas rusak',
  follow_up_needed: 'Perlu tindak lanjut',
  other: 'Lainnya',
};
export const stateNames: Record<string, string> = {
  submitted: 'Menunggu tinjauan',
  under_review: 'Sedang ditinjau',
  clarification_requested: 'Perlu klarifikasi',
  reviewed: 'Ditinjau koordinator',
  rejected: 'Tidak dapat dikonfirmasi',
  closed: 'Ditutup',
  queued: 'Menunggu koneksi',
  syncing: 'Menyinkronkan',
  sync_failed: 'Belum terkirim',
  draft: 'Draf di perangkat',
};
const ok = z.object({ ok: z.boolean() });
export function ReportForm({ region, online }: { region: Region; online: boolean }) {
  const parameters = new URLSearchParams(useLocation().search);
  const help = parameters.get('help') === '1';
  const requestedCategory = region.config.categories.find((c) => c === parameters.get('category'));
  const navigate = useNavigate();
  const [category, setCategory] = useState(
    help ? 'follow_up_needed' : (requestedCategory ?? region.config.categories[0]!),
  );
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [observed, setObserved] = useState('');
  const [location, setLocation] = useState<
    { latitude: number; longitude: number; accuracyMeters?: number } | undefined
  >();
  const [followUp, setFollowUp] = useState(help);
  const [contact, setContact] = useState('');
  const [permission, setPermission] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [queued, setQueued] = useState(false);
  const attempt = useRef<{
    key: string;
    payload: z.infer<typeof createReportSchema>;
    durable: boolean;
  } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!consent) {
      setError('Persetujuan penyimpanan laporan diperlukan.');
      return;
    }
    const payload = createReportSchema.safeParse({
      regionId: region.id,
      category,
      description,
      landmarkText: landmark,
      observationTime: observed ? new Date(observed).toISOString() : null,
      ...(location ? { location } : {}),
      followUpRequested: followUp,
      contactPermission: permission,
      ...(online && permission && contact ? { contactDetails: contact } : {}),
      privacyConsent: true,
      trackingToken: crypto.randomUUID() + crypto.randomUUID(),
    });
    if (!payload.success) {
      setError(payload.error.issues.map((i) => i.message).join('; '));
      return;
    }
    setBusy(true);
    try {
      if (!navigator.onLine) {
        const offlinePayload = { ...payload.data, contactPermission: false };
        delete offlinePayload.contactDetails;
        delete offlinePayload.location;
        await enqueue(offlinePayload);
        navigate('/tracking');
        return;
      }
      if (!attempt.current)
        attempt.current = {
          key: crypto.randomUUID(),
          payload: payload.data,
          durable: !payload.data.contactDetails && !payload.data.location,
        };
      const { key, payload: original, durable } = attempt.current;
      setQueued(durable);
      // Persist before network so a timeout or browser restart can replay exactly this payload.
      if (durable)
        await residentDb.drafts.put({
          localId: key,
          idempotencyKey: key,
          payload: original,
          state: 'queued',
          retryCount: 0,
          updatedAt: new Date().toISOString(),
        });
      const receipt = await request('/reports', receiptSchema, {
        method: 'POST',
        body: original,
        headers: { 'Idempotency-Key': key },
      });
      await residentDb.transaction('rw', residentDb.receipts, residentDb.drafts, async () => {
        await residentDb.receipts.put({ ...receipt, createdAt: new Date().toISOString() });
        await residentDb.drafts.delete(key);
      });
      setAccepted(true);
      if (file) {
        try {
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]!);
            reader.onerror = () => reject(new Error('Foto gagal dibaca'));
            reader.readAsDataURL(file);
          });
          await request('/reports/' + receipt.id + '/attachments', z.object({ id: z.uuid() }), {
            method: 'POST',
            body: { data: encoded },
            headers: { 'X-Tracking-Token': receipt.trackingToken },
          });
        } catch {
          setError(
            'Laporan diterima, tetapi foto gagal dikirim. Lihat status laporan melalui Laporan saya.',
          );
          return;
        }
      }
      navigate('/tracking');
    } catch (error) {
      setError(
        (error instanceof Error ? error.message : 'Laporan belum terkirim.') +
          (attempt.current?.durable
            ? ' Laporan tersimpan di antrean; periksa Laporan saya sebelum mengirim laporan baru.'
            : ' Kontak dan GPS tidak disimpan di perangkat. Tekan Kirim untuk mencoba ulang pengiriman yang sama; jangan tutup halaman sampai ada konfirmasi.'),
      );
    } finally {
      setBusy(false);
    }
  }
  function gps() {
    if (!navigator.geolocation) {
      setError('Perangkat tidak mendukung lokasi. Gunakan patokan manual.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracyMeters: p.coords.accuracy,
        });
        setError('');
      },
      () => setError('Lokasi tidak tersedia. Anda tetap dapat menulis patokan manual.'),
      { timeout: 10000, maximumAge: 0 },
    );
  }
  return (
    <div className="narrow">
      <PageHeader
        eyebrow="Laporan warga"
        title="Bagikan yang Anda lihat."
        description="Tuliskan pengamatan Anda. Laporan diterima platform untuk ditinjau koordinator komunitas."
      />
      <Notice tone="warning">
        Simulasi — bukan kejadian nyata. Ini bukan kanal pengiriman layanan darurat dan tidak
        menjamin bantuan dikirim.
      </Notice>
      {!online && (
        <Notice>
          Laporan akan disimpan di perangkat. Kontak, foto, dan koordinat GPS tidak disimpan untuk
          draf offline. Hindari data sensitif dalam teks pada perangkat bersama.
        </Notice>
      )}
      <form className="panel" onSubmit={(e) => void submit(e)}>
        <Field label="Jenis laporan">
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {region.config.categories.map((c) => (
              <option key={c} value={c}>
                {categoryNames[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Apa yang Anda amati?"
          hint="10–2.000 karakter. Jangan menyertakan kontak pribadi dalam teks."
        >
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: terlihat genangan di jalan dekat patokan…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Patokan lokasi (opsional)">
            <input
              maxLength={300}
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Nama jalan / bangunan / RT"
            />
          </Field>
          <Field label="Waktu pengamatan (opsional)" hint="Kosongkan jika tidak diketahui.">
            <input
              type="datetime-local"
              value={observed}
              onChange={(e) => setObserved(e.target.value)}
            />
          </Field>
        </div>
        <div className="form-section">
          <h3>Lokasi & foto (opsional)</h3>
          <div className="actions">
            <button type="button" onClick={gps} disabled={!online}>
              <Icon name="pin" />
              Gunakan lokasi perangkat
            </button>
            {location && (
              <>
                <span className="hint">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </span>
                <button type="button" className="quiet" onClick={() => setLocation(undefined)}>
                  Hapus lokasi
                </button>
              </>
            )}
          </div>
          <Field
            label="Foto pengamatan"
            hint="JPEG/PNG, maks. 2 MB. Foto privat; metadata lokasi dihapus server."
          >
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={!online}
              onChange={(e) => {
                const photo = e.target.files?.[0];
                if (photo && photo.size > 2000000) {
                  setError('Foto maksimal 2 MB.');
                  setFile(null);
                  e.target.value = '';
                } else setFile(photo ?? null);
              }}
            />
          </Field>
        </div>
        <div className="form-section">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
            />
            <span>
              Saya membutuhkan tindak lanjut komunitas.
              <small className="muted"> Detail hanya dibuka pengelola yang berwenang.</small>
            </span>
          </label>
          {followUp && online && (
            <>
              <Field label="Kontak untuk tindak lanjut (opsional)">
                <input
                  value={contact}
                  maxLength={200}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Kanal kontak yang dapat dihubungi"
                />
              </Field>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                />
                <span>
                  Saya mengizinkan koordinator menggunakan kontak ini untuk tindak lanjut.
                </span>
              </label>
            </>
          )}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Saya memahami <Link to="/help">penggunaan dan penyimpanan data</Link>. Laporan ini
            merupakan pengamatan yang perlu ditinjau.
          </span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="button-row">
          <button className="primary" disabled={busy || accepted || queued} type="submit">
            <Icon name="report" />
            {busy ? 'Memproses…' : online ? 'Kirim laporan' : 'Simpan laporan offline'}
          </button>
          <Link to="/tracking" className="button">
            Laporan saya
          </Link>
        </div>
      </form>
    </div>
  );
}
export function TrackingPage() {
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const load = () => {
      void Promise.all([
        residentDb.drafts.toArray(),
        residentDb.receipts.orderBy('createdAt').reverse().toArray(),
      ])
        .then(([d, r]) => {
          setDrafts(d);
          setReceipts(r);
        })
        .catch(() => setMessage('Penyimpanan perangkat tidak tersedia.'));
    };
    load();
    window.addEventListener('tandara:queue', load);
    return () => window.removeEventListener('tandara:queue', load);
  }, []);
  async function sync() {
    setBusy(true);
    setMessage('');
    try {
      await residentDb.drafts.toCollection().modify({ retryCount: 0 });
      await synchronize();
      setDrafts(await residentDb.drafts.toArray());
      setReceipts(await residentDb.receipts.orderBy('createdAt').reverse().toArray());
      setMessage(
        'Sinkronisasi selesai. Status di bawah menunjukkan apakah server telah menerima laporan.',
      );
    } catch {
      setMessage('Sinkronisasi gagal. Laporan tetap di perangkat.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <PageHeader
        eyebrow="Laporan saya"
        title="Setiap laporan, status yang jelas."
        description="Tanda terima disimpan di perangkat ini. Hanya laporan dengan konfirmasi server yang berstatus diterima."
        action={
          <button onClick={() => void sync()} disabled={busy || !navigator.onLine}>
            {busy ? 'Menyinkronkan…' : 'Sinkronkan antrean'}
          </button>
        }
      />
      {message && <Notice>{message}</Notice>}
      {drafts.length > 0 && (
        <section className="panel">
          <h2>Antrean di perangkat</h2>
          {drafts.map((d) => (
            <div className="source-details" key={d.localId}>
              <div>
                <Badge tone="amber">{stateNames[d.state]} · belum dikonfirmasi server</Badge>
                <p>{d.payload.description}</p>
                <small>
                  {formatTime(d.updatedAt)} · percobaan {d.retryCount}/5
                </small>
                {d.error && <Notice tone="error">{d.error}</Notice>}
              </div>
              <button
                className="danger small"
                onClick={async () => {
                  await residentDb.drafts.delete(d.localId);
                  setDrafts(await residentDb.drafts.toArray());
                }}
              >
                Hapus draf
              </button>
            </div>
          ))}
        </section>
      )}
      {receipts.map((r) => (
        <ReceiptCard key={r.id} receipt={r} />
      ))}
      {!drafts.length && !receipts.length && (
        <Empty title="Belum ada laporan di perangkat">
          <Link to="/report">Buat laporan pengamatan</Link>. Tanda terima perangkat lain tidak
          ditampilkan di sini.
        </Empty>
      )}
    </div>
  );
}
function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const [message, setMessage] = useState('');
  const result = useQuery({
    queryKey: ['receipt', receipt.id],
    queryFn: () =>
      request('/reports/' + receipt.id + '/tracking', trackingSchema, {
        headers: { 'X-Tracking-Token': receipt.trackingToken },
      }),
    retry: 1,
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Laporan {receipt.id.slice(0, 8)}</h2>
        <Badge tone="teal">Diterima platform</Badge>
      </div>
      <p>{stateNames[result.data?.state ?? receipt.state]}</p>
      {result.data?.erased && (
        <Notice>
          Data laporan telah dihapus. Tanda terima dan jejak status minimum dipertahankan.
        </Notice>
      )}
      <p className="meta">
        Dikirim {formatTime(receipt.createdAt)} · diperbarui {formatTime(result.data?.updatedAt)}
      </p>
      {result.data?.assistanceState && (
        <Notice>
          Status tindak lanjut komunitas: {result.data.assistanceState}. Bukan konfirmasi layanan
          darurat.
        </Notice>
      )}
      {result.isError && (
        <Notice tone="warning">
          Status terbaru tidak tersedia. Tanda terima tersimpan; coba lagi saat terhubung.
        </Notice>
      )}
      <details>
        <summary>Riwayat status & tanda terima</summary>
        <ul className="timeline">
          {result.data?.history.map((h) => (
            <li key={h.id}>
              <strong>{stateNames[h.action] ?? h.action}</strong>
              <p>{h.reason}</p>
              <small>{formatTime(h.createdAt)}</small>
            </li>
          ))}
        </ul>
        <p className="receipt-secret">Token privat: {receipt.trackingToken}</p>
        <p className="hint">
          Jangan bagikan token ini. Simpan ID dan token sebelum menghapus data perangkat.
        </p>
      </details>
      <div className="button-row">
        <button onClick={() => void result.refetch()}>Perbarui status</button>
        <button
          className="danger"
          onClick={async () => {
            try {
              await request('/reports/' + receipt.id + '/deletion-request', ok, {
                method: 'POST',
                headers: { 'X-Tracking-Token': receipt.trackingToken },
              });
              setMessage('Permintaan penghapusan diterima. Administrator akan memprosesnya.');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Permintaan gagal.');
            }
          }}
        >
          Ajukan penghapusan
        </button>
      </div>
      {message && <Notice>{message}</Notice>}
    </section>
  );
}
export function TrainingPage({ region }: { region: Region }) {
  const query = useQuery({
    queryKey: ['training', region.id],
    queryFn: () => request('/regions/' + region.id + '/training', z.array(trainingSchema)),
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [key] = useState(crypto.randomUUID());
  const scenario = query.data?.[0];
  return (
    <div className="narrow">
      <PageHeader
        eyebrow="Latihan kesiapsiagaan"
        title="Pahami informasi sebelum situasi berubah."
      />
      <Notice tone="warning">LATIHAN SIMULASI — bukan peringatan atau kejadian nyata.</Notice>
      {query.isPending ? (
        <div className="loading">Memuat latihan…</div>
      ) : query.isError ? (
        <Notice tone="error">Latihan belum tersedia saat koneksi ini.</Notice>
      ) : scenario ? (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await request(
                '/regions/' + region.id + '/training/' + scenario.id + '/results',
                z.object({ score: z.number(), total: z.number() }),
                {
                  method: 'POST',
                  body: {
                    answers: scenario.content.steps.map((_, i) => answers[i] ?? -1),
                    feedback,
                    completionKey: key,
                  },
                },
              );
              setResult(r);
              setMessage('Latihan selesai. Baca penjelasan untuk meninjau kembali pemahaman Anda.');
              void query.refetch();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Gagal menyimpan latihan.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{scenario.content.title}</h2>
          <p>{scenario.content.description}</p>
          {scenario.content.steps.map((s, i) => (
            <fieldset key={i}>
              <legend>
                {i + 1}. {s.question}
              </legend>
              <div className="training-options">
                {s.options.map((o, j) => (
                  <label key={j}>
                    <input
                      type="radio"
                      name={'question-' + i}
                      required
                      checked={answers[i] === j}
                      onChange={() => setAnswers({ ...answers, [i]: j })}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
              {result && (
                <Notice tone={answers[i] === s.answer ? 'success' : 'warning'}>
                  {s.explanation}
                </Notice>
              )}
            </fieldset>
          ))}
          <Field
            label="Bagian yang perlu diperjelas (opsional)"
            hint="Jangan menuliskan data pribadi. Feedback hanya untuk pengelola latihan."
          >
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={500}
            />
          </Field>
          <button className="primary" disabled={busy || !!result}>
            {busy ? 'Menyimpan…' : 'Selesaikan latihan'}
          </button>
          {message && (
            <Notice>
              {message}
              {result && (
                <p>
                  {result.score} dari {result.total} jawaban sesuai materi latihan. Ini bukan ukuran
                  keamanan Anda.
                </p>
              )}
            </Notice>
          )}
        </form>
      ) : (
        <Empty title="Belum ada latihan">Pengelola belum membuat skenario untuk wilayah ini.</Empty>
      )}
    </div>
  );
}
