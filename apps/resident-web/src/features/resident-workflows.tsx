import { useEffect, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import {
  workflowLabels,
  createReportSchema,
  receiptSchema,
  trackingSchema,
  trainingSchema,
  residentReportPageSchema,
  residentReportSchema,
  residentClaimResultSchema,
} from '@tandara/contracts';
import type { Region } from '@tandara/contracts';
import { createUuid, formatTime } from '@tandara/ui';
import { residentDb } from '../offline/database.js';
import type { Receipt } from '../offline/database.js';
import type { ResidentData } from './resident-data.js';
import { residentCsrf } from '../account/session.js';
import { enqueue, synchronize } from '../offline/sync.js';
import { WButton, WEmpty, WError, WIcon, WLink, WProgress, WRow } from './chalk-ui.js';
import { useDesktop } from './resident-data.js';
import { StreetMap } from './resident-map.js';
import { ReportFeedback } from './report-feedback.js';

export const categoryNames: Record<string, string> = {
  road_flooding: 'Genangan',
  water_entering_homes: 'Air masuk rumah',
  blocked_access: 'Jalan terhambat',
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
export function ReportForm({
  region,
  online,
  residentId,
}: {
  region: Region;
  online: boolean;
  residentId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const currentLocation = useLocation();
  const parameters = new URLSearchParams(currentLocation.search);
  const help = parameters.get('help') === '1' || currentLocation.pathname === '/support';
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
  const followUp = help;
  const [contact, setContact] = useState('');
  const [permission, setPermission] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [queued, setQueued] = useState(false);
  const attempt = useRef<{
    key: string;
    payload: z.infer<typeof createReportSchema>;
    durable: boolean;
    residentId?: string | undefined;
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
      trackingToken: createUuid() + createUuid(),
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
        await enqueue(offlinePayload, residentId);
        await queryClient.invalidateQueries({ queryKey: ['resident-receipts'] });
        navigate('/tracking', { state: { queued: true } });
        return;
      }
      if (!attempt.current)
        attempt.current = {
          key: createUuid(),
          payload: payload.data,
          durable: !payload.data.contactDetails && !payload.data.location,
          residentId,
        };
      const { key, payload: original, durable, residentId: attemptResidentId } = attempt.current;
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
          residentId: attemptResidentId,
        });
      const receipt = await request('/reports', receiptSchema, {
        method: 'POST',
        body: original,
        headers: {
          'Idempotency-Key': key,
          'X-CSRF-Token': residentCsrf(),
          ...(attemptResidentId ? { 'X-Resident-Id': attemptResidentId } : {}),
        },
      });
      await residentDb.transaction('rw', residentDb.receipts, residentDb.drafts, async () => {
        await residentDb.receipts.put({
          ...receipt,
          createdAt: new Date().toISOString(),
          description: original.description,
          category: original.category,
          landmark: original.landmarkText,
          followUp: help,
          title: help ? helpType : undefined,
        });
        await residentDb.drafts.delete(key);
      });
      setAccepted(true);
      await queryClient.invalidateQueries({ queryKey: ['resident-receipts'] });
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
      navigate('/tracking', { state: { submitted: true } });
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
  const desktop = useDesktop();
  const [step, setStep] = useState(0);
  const [helpType, setHelpType] = useState('Kebutuhan dasar');
  const [timeMode, setTimeMode] = useState('now');
  const frozen = busy || accepted || queued;
  function next() {
    if (!description.trim() || description.trim().length < 10) {
      setError('Jelaskan kejadian dengan minimal 10 karakter.');
      return;
    }
    setError('');
    setStep((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const categoryControl = (
    <label className="w-field">
      <span>Jenis kejadian</span>
      <span className="w-category-control">
        <WIcon name="water" />
        <select
          aria-label="Jenis kejadian"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          disabled={frozen}
        >
          {region.config.categories
            .filter((c) => c !== 'follow_up_needed')
            .map((c) => (
              <option key={c} value={c}>
                {categoryNames[c]}
              </option>
            ))}
        </select>
      </span>
    </label>
  );
  const detailFields = (
    <>
      {!help && categoryControl}
      <label className="w-field">
        <span>{help ? 'Bantuan yang dibutuhkan' : 'Kejadian'}</span>
        <textarea
          aria-label={help ? 'Bantuan yang dibutuhkan' : 'Apa yang Anda amati?'}
          placeholder={help ? 'Jelaskan bantuan yang dibutuhkan' : 'Jelaskan apa yang kamu lihat'}
          minLength={10}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={frozen}
        />
      </label>
      {!help && (
        <>
          <label className="w-photo-upload">
            <input
              type="file"
              aria-label="Foto kejadian"
              accept="image/jpeg,image/png"
              disabled={!online || frozen}
              onChange={(e) => {
                const photo = e.target.files?.[0];
                if (
                  photo &&
                  (photo.size > 2000000 || !['image/jpeg', 'image/png'].includes(photo.type))
                ) {
                  setError('Pilih foto JPG atau PNG, maksimal 2 MB.');
                  e.target.value = '';
                  return;
                }
                setFile(photo ?? null);
                setPhotoPreview(photo ? URL.createObjectURL(photo) : '');
                setError('');
              }}
            />
            {photoPreview ? (
              <img
                className="w-photo-preview"
                src={photoPreview}
                width={80}
                height={80}
                alt="Foto kejadian"
              />
            ) : (
              <WIcon name="camera" size={32} />
            )}
            <span>
              <strong>{file?.name ?? 'Tambah foto'}</strong>
              <small>{file ? 'Foto dipilih' : 'Boleh dikosongkan'}</small>
            </span>
          </label>
          <div className="w-stack">
            <h3>Waktu kejadian</h3>
            <div className="w-chips">
              <button
                type="button"
                className={timeMode === 'now' ? 'is-active' : ''}
                onClick={() => {
                  setTimeMode('now');
                  setObserved('');
                }}
              >
                Baru saja
              </button>
              <button
                type="button"
                className={timeMode === 'pick' ? 'is-active' : ''}
                onClick={() => setTimeMode('pick')}
              >
                Pilih waktu
              </button>
            </div>
            {timeMode === 'pick' && (
              <label className="w-field">
                <span>Waktu kejadian</span>
                <input
                  type="datetime-local"
                  value={observed}
                  onChange={(e) => setObserved(e.target.value)}
                  required
                />
              </label>
            )}
          </div>
        </>
      )}
    </>
  );
  const locationFields = (
    <>
      <h3>Lokasi kejadian</h3>
      <div className="w-report-map">
        <StreetMap
          region={region}
          picked={location}
          onPick={(point) => {
            if (!frozen) setLocation(point);
          }}
        />
      </div>
      <button
        type="button"
        className="w-location-action"
        onClick={gps}
        disabled={!online || frozen}
      >
        <WIcon name="locate" size={20} />
        Gunakan lokasiku
      </button>
      <label className="w-field">
        <span>Patokan lokasi</span>
        <input
          value={landmark}
          maxLength={300}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder="Nama jalan, bangunan, atau RT"
          disabled={frozen}
        />
      </label>
      {location && (
        <button type="button" className="w-text-button" onClick={() => setLocation(undefined)}>
          Hapus pin lokasi
        </button>
      )}
    </>
  );
  const contactFields = (
    <>
      <h2>{residentId ? 'Nomor lain untuk dihubungi' : 'Bagaimana Posko bisa menghubungimu?'}</h2>
      <label className="w-field">
        <span>{residentId ? 'Nomor tambahan' : 'Nomor telepon'}</span>
        <input
          type="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          autoComplete="tel"
          placeholder="08xx xxxx xxxx"
          disabled={frozen || !online}
        />
      </label>
      <label className="w-switch-row">
        <span>
          <strong>{residentId ? 'Bagikan nomor tambahan' : 'Boleh dihubungi Posko'}</strong>
          <small>Lewat nomor di atas</small>
        </span>
        <input
          role="switch"
          type="checkbox"
          checked={online && permission}
          disabled={!online || frozen}
          onChange={(e) => setPermission(e.target.checked)}
        />
      </label>
      <WButton
        quiet
        onClick={() => {
          setPermission(false);
          setContact('');
        }}
      >
        {residentId ? 'Gunakan nomor akun' : 'Lanjut tanpa nomor'}
      </WButton>
    </>
  );
  const consentField = (
    <label className="w-consent">
      <input
        type="checkbox"
        required
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
      />
      <span>
        Saya menyetujui <Link to="/help">penggunaan data laporan</Link>.
        {residentId && ' Nomor akunmu ikut dikirim ke Posko.'}
      </span>
    </label>
  );
  const submitButton = (
    <WButton type="submit" disabled={frozen}>
      {busy
        ? 'Mengirim…'
        : accepted
          ? 'Laporan diterima'
          : queued
            ? 'Periksa Laporan saya'
            : !online
              ? 'Simpan laporan offline'
              : help
                ? 'Kirim permintaan'
                : 'Kirim laporan'}
    </WButton>
  );
  if (!desktop && !help && step === 0)
    return (
      <div className="w-report-mobile">
        <div className="w-mobile-back">
          <Link to="/">
            <WIcon name="back" />
          </Link>
          <strong>Buat laporan</strong>
        </div>
        <h1>Apa yang kamu lihat?</h1>
        <p className="w-muted">Pilih jenis kejadian.</p>
        <div className="w-category-grid">
          {region.config.categories
            .filter((c) => c !== 'follow_up_needed')
            .map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? 'is-selected' : ''}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                <WIcon
                  name={
                    c === 'blocked_access'
                      ? 'walk'
                      : c === 'damaged_facility'
                        ? 'building'
                        : c === 'other'
                          ? 'message'
                          : 'water'
                  }
                  size={32}
                />
                <strong>{categoryNames[c]}</strong>
              </button>
            ))}
        </div>
        <WRow to="/support" title="Butuh bantuan?" subtitle="Minta bantuan Posko" icon="help" />
        <div className="w-mobile-action">
          <WButton onClick={() => setStep(1)}>Lanjut</WButton>
        </div>
      </div>
    );
  return (
    <div className="w-report-page">
      <div className="w-page-heading">
        <h1>
          {help
            ? 'Minta bantuan'
            : desktop
              ? 'Laporkan kejadian'
              : step === 1
                ? 'Jelaskan kejadiannya.'
                : step === 2
                  ? 'Tentukan lokasi'
                  : 'Periksa sebelum kirim.'}
        </h1>
        {!desktop && (
          <button
            className="w-icon-button"
            aria-label="Kembali"
            onClick={() => setStep((n) => Math.max(0, n - 1))}
          >
            <WIcon name="back" />
          </button>
        )}
      </div>
      {!desktop && !help && <WProgress value={step} total={3} label="Langkah laporan" />}
      <form
        className={desktop ? 'w-report-columns' : 'w-report-mobile-form'}
        onSubmit={(e) => void submit(e)}
      >
        {(desktop || (help ? step === 0 : step === 1)) && (
          <section className="w-card w-report-fields">
            {help && (
              <div className="w-stack">
                <h2>Bantuan apa yang dibutuhkan?</h2>
                {['Kebutuhan dasar', 'Bantuan pendamping', 'Lainnya'].map((item, i) => (
                  <WRow
                    key={item}
                    title={item}
                    subtitle={
                      [
                        'Air, makanan, perlengkapan',
                        'Untuk lansia, anak, atau sulit berjalan',
                        'Jelaskan bantuan yang dibutuhkan',
                      ][i]
                    }
                    icon={i === 1 ? 'users' : 'help'}
                    selected={helpType === item}
                    onClick={() => setHelpType(item)}
                  />
                ))}
              </div>
            )}
            {detailFields}
            {help && !desktop && (
              <label className="w-field">
                <span>Patokan lokasi</span>
                <input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  maxLength={300}
                />
              </label>
            )}
          </section>
        )}
        {(desktop || (!help && step === 2)) && (
          <section className="w-card w-report-location">
            {locationFields}
            {desktop && (
              <>
                {help && contactFields}
                <label className="w-field">
                  <span>Penerima laporan</span>
                  <input value={region.organization} readOnly />
                </label>
                {consentField}
                {error && <WError>{error}</WError>}
                {submitButton}
              </>
            )}
          </section>
        )}
        {!desktop && help && step >= 1 && (
          <section className="w-stack">
            {contactFields}
            {consentField}
          </section>
        )}
        {!desktop && !help && step === 3 && (
          <div className="w-stack">
            <section className="w-card w-stack">
              {categoryControl}
              <h3>{description}</h3>
              <small className="w-muted">
                {observed ? new Date(observed).toLocaleString('id-ID') : 'Baru saja'}
                {landmark ? ' · ' + landmark : ''}
              </small>
              <div className="w-review-map">
                <StreetMap compact region={region} picked={location} />
              </div>
            </section>
            <WButton secondary onClick={() => setStep(1)}>
              Ubah laporan
            </WButton>
            <label className="w-field">
              <span>Penerima laporan</span>
              <input value={region.organization} readOnly />
            </label>
            {consentField}
          </div>
        )}
        {!desktop && (
          <>
            {error && <WError>{error}</WError>}
            <div className="w-mobile-action">
              {(help ? step >= 1 : step === 3) ? (
                submitButton
              ) : (
                <WButton type="button" onClick={next}>
                  {help ? 'Lanjut' : step === 1 ? 'Tentukan lokasi' : 'Cek laporan'}
                </WButton>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export function TrackingPage({ app }: { app: ResidentData }) {
  const client = useQueryClient();
  const residentId = app.session.data?.user?.id;
  const accountReports = useInfiniteQuery({
    queryKey: ['resident-account-reports', residentId],
    enabled: !!residentId && app.online,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      request('/resident/reports?page=' + pageParam, residentReportPageSchema),
    getNextPageParam: (last) => (last.page * 50 < last.total ? last.page + 1 : undefined),
    refetchInterval: app.online ? 30000 : false,
  });
  const desktop = useDesktop(),
    location = useLocation(),
    navigate = useNavigate();
  const selectedId = new URLSearchParams(location.search).get('id');
  const [message, setMessage] = useState(''),
    [syncing, setSyncing] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState(false);
  const stored = useQuery({
    queryKey: ['resident-receipts'],
    networkMode: 'always',
    queryFn: async () => ({
      drafts: await residentDb.drafts.toArray(),
      receipts: await residentDb.receipts.orderBy('createdAt').reverse().toArray(),
    }),
  });
  const reloadStored = stored.refetch;
  useEffect(() => {
    const reload = () => {
      void reloadStored();
    };
    window.addEventListener('tandara:queue', reload);
    return () => window.removeEventListener('tandara:queue', reload);
  }, [reloadStored]);
  const localReceipts = (stored.data?.receipts ?? []).filter(
    (receipt) => !receipt.residentId || receipt.residentId === residentId,
  );
  const asReceipt = (record: z.infer<typeof residentReportSchema>): Receipt => ({
    ...record,
    landmark: record.landmark ?? undefined,
    residentId,
  });
  const requested = useQuery({
    queryKey: ['resident-account-report', residentId, selectedId],
    enabled: !!residentId && !!selectedId && app.online,
    queryFn: () =>
      request('/resident/reports/' + encodeURIComponent(selectedId ?? ''), residentReportSchema),
    retry: false,
  });
  const receiptMap = new Map(localReceipts.map((r) => [r.id, r]));
  if (residentId)
    for (const record of [
      ...(accountReports.data?.pages.flatMap((page) => page.items) ?? []),
      ...(requested.data ? [requested.data] : []),
    ])
      receiptMap.set(record.id, { ...receiptMap.get(record.id), ...asReceipt(record) });
  const receipts = [...receiptMap.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const drafts = (stored.data?.drafts ?? []).filter(
    (draft) => !draft.residentId || draft.residentId === residentId,
  );
  const selected = selectedId
    ? receipts.find((r) => r.id === selectedId)
    : desktop || location.state?.submitted
      ? receipts[0]
      : undefined;
  const tracking = useQuery({
    queryKey: ['receipt', selected?.id, residentId],
    enabled: !!selected,
    queryFn: () =>
      request(
        (!selected!.trackingToken && selected!.residentId === residentId && residentId
          ? '/resident/reports/'
          : '/reports/') +
          selected!.id +
          '/tracking',
        trackingSchema,
        {
          headers: selected!.trackingToken ? { 'X-Tracking-Token': selected!.trackingToken } : {},
        },
      ),
    refetchInterval: navigator.onLine ? 30000 : false,
  });
  async function sync() {
    setSyncing(true);
    try {
      await residentDb.drafts.toCollection().modify({ retryCount: 0 });
      await synchronize();
      await stored.refetch();
      setMessage('Antrean diperbarui.');
    } catch {
      setMessage('Belum dapat mengirim antrean. Coba lagi.');
    } finally {
      setSyncing(false);
    }
  }
  const receiptTitle = (receipt: Receipt) =>
    receipt.title ??
    (receipt.followUp
      ? 'Permintaan bantuan'
      : (categoryNames[receipt.category ?? ''] ?? 'Laporan ' + receipt.id.slice(0, 8)));
  const detail = selected && (
    <div className="w-status-detail">
      {!desktop && (
        <div className="w-mobile-back">
          <Link to="/tracking">
            <WIcon name="back" />
          </Link>
          <strong>{selected.followUp ? 'Status permintaan' : 'Detail laporan'}</strong>
        </div>
      )}
      <section className="w-card w-report-identity">
        <h2>
          <WIcon name={selected.followUp ? 'help' : 'water'} />
          {receiptTitle(selected)}
        </h2>
        {selected.description && <p>{selected.description}</p>}
        <small>
          {selected.id.slice(0, 8).toUpperCase()} · {formatTime(selected.createdAt)}
        </small>
        {selected.landmark && <small>{selected.landmark}</small>}
      </section>
      <h3>{selected.followUp ? 'Status permintaan' : 'Status laporan'}</h3>
      <ol className="w-timeline">
        <li>
          <WIcon name="check" size={22} />
          <div>
            <strong>Diterima</strong>
            <small>{formatTime(selected.createdAt)} · Laporan masuk ke Posko</small>
          </div>
        </li>
        {tracking.data?.history
          .filter((h) => h.action !== 'submitted' && h.action !== 'report.created')
          .map((h) => (
            <li key={h.id}>
              <WIcon name="check" size={22} />
              <div>
                <strong>{stateNames[h.action] ?? h.action}</strong>
                {h.reason && <small>{h.reason}</small>}
                <small>{formatTime(h.createdAt)}</small>
              </div>
            </li>
          ))}
        {tracking.data?.updates?.map((update) => (
          <li key={update.id}>
            <WIcon name="check" size={22} />
            <div>
              <strong>
                {workflowLabels[update.action as keyof typeof workflowLabels] ?? update.action}
              </strong>
              <small>{update.message}</small>
              <small>{formatTime(update.createdAt)}</small>
            </div>
          </li>
        ))}
        <li className="is-current">
          <span className="w-timeline-dot" />
          <div>
            <strong>
              {tracking.data?.workflow
                ? workflowLabels[tracking.data.workflow.status]
                : (stateNames[tracking.data?.state ?? selected.state] ?? selected.state)}
            </strong>
            {tracking.data?.assistanceState && <small>{tracking.data.assistanceState}</small>}
          </div>
        </li>
      </ol>
      {tracking.data?.workflow && !tracking.data.erased && (
        <ReportFeedback
          key={selected.id}
          id={selected.id}
          token={selected.trackingToken}
          workflow={tracking.data.workflow}
          onSaved={() => tracking.refetch()}
        />
      )}
      {tracking.isError && <WError>Status terbaru belum dapat dimuat.</WError>}
      {tracking.data?.erased && <p role="status">Data laporan telah dihapus.</p>}
      <div className="w-status-actions">
        <WButton secondary onClick={() => void tracking.refetch()}>
          Perbarui status
        </WButton>
        {!tracking.data?.erased && (
          <WButton quiet onClick={() => setConfirm(true)}>
            Ajukan penghapusan
          </WButton>
        )}
      </div>
    </div>
  );
  return (
    <div className="w-tracking">
      <div className="w-page-heading">
        <h1>Status laporan saya</h1>
        <WLink to="/report">Buat laporan</WLink>
      </div>
      {(location.state?.submitted || location.state?.queued) && (
        <div className="w-confirmation" role="status">
          <WIcon name="check" size={40} />
          <div>
            <h2>
              {!location.state?.queued && receipts.length
                ? receipts[0]?.followUp
                  ? 'Permintaan terkirim'
                  : 'Laporan terkirim'
                : 'Laporan menunggu koneksi'}
            </h2>
            <p>
              {!location.state?.queued && receipts.length
                ? 'Lihat perkembangannya di sini.'
                : 'Laporan akan dikirim setelah tersambung internet.'}
            </p>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {stored.isError && <WError>Laporan di perangkat belum dapat dibaca.</WError>}
      {selectedId && !selected && (!residentId || requested.isError) && (
        <WEmpty title="Laporan tidak ditemukan" />
      )}
      {residentId && accountReports.isPending && <p role="status">Memuat laporan akun…</p>}
      {residentId && accountReports.isError && <WError>Laporan akun belum dapat dimuat.</WError>}
      {residentId && localReceipts.some((r) => !r.residentId && r.trackingToken) && (
        <WButton
          secondary
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            try {
              const old = localReceipts
                .filter((r) => !r.residentId && r.trackingToken)
                .slice(0, 100);
              const result = await request('/resident/reports/claim', residentClaimResultSchema, {
                method: 'POST',
                body: { reports: old.map((r) => ({ id: r.id, trackingToken: r.trackingToken })) },
                headers: { 'X-CSRF-Token': residentCsrf() },
              });
              await residentDb.transaction('rw', residentDb.receipts, async () => {
                for (const id of result.claimedIds)
                  await residentDb.receipts.update(id, { residentId });
              });
              await stored.refetch();
              await client.invalidateQueries({ queryKey: ['resident-account-reports'] });
              setMessage(
                result.claimedIds.length
                  ? 'Laporan tersambung ke akunmu.'
                  : 'Laporan tidak dapat dihubungkan ke akun ini.',
              );
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Laporan belum tersambung.');
            } finally {
              setSyncing(false);
            }
          }}
        >
          Hubungkan laporan di perangkat ini ke akun
        </WButton>
      )}
      {drafts.length > 0 && (
        <section className="w-card w-stack">
          <div className="w-page-heading">
            <h2>Belum terkirim</h2>
            <WButton secondary disabled={syncing || !navigator.onLine} onClick={() => void sync()}>
              {syncing ? 'Mengirim…' : 'Kirim ulang'}
            </WButton>
          </div>
          {drafts.map((d) => (
            <div className="w-draft-row" key={d.localId}>
              <div>
                <strong>{stateNames[d.state]}</strong>
                <p>{d.payload.description}</p>
                <small>{formatTime(d.updatedAt)}</small>
                {d.error && <WError>{d.error}</WError>}
              </div>
              <WButton
                quiet
                onClick={async () => {
                  await residentDb.drafts.delete(d.localId);
                  await stored.refetch();
                }}
              >
                Hapus draf
              </WButton>
            </div>
          ))}
        </section>
      )}
      <div className={'w-tracking-layout ' + (!desktop && selected ? 'show-detail' : '')}>
        <div className="w-report-list">
          {receipts.map((receipt) => (
            <WRow
              key={receipt.id}
              title={receipt.description ? receipt.description.slice(0, 64) : receiptTitle(receipt)}
              subtitle={receiptTitle(receipt) + ' · ' + formatTime(receipt.createdAt)}
              selected={selected?.id === receipt.id}
              icon={receipt.followUp ? 'help' : 'report'}
              onClick={() => navigate('/tracking?id=' + receipt.id)}
            />
          ))}
          {accountReports.hasNextPage && (
            <WButton
              secondary
              disabled={accountReports.isFetchingNextPage}
              onClick={() => void accountReports.fetchNextPage()}
            >
              Lihat laporan lainnya
            </WButton>
          )}
        </div>
        {detail}
      </div>
      {!stored.isPending &&
        (!residentId || !accountReports.isPending) &&
        !receipts.length &&
        !drafts.length && (
          <WEmpty title="Belum ada laporan">
            <p>Laporan dan permintaan bantuanmu muncul di sini.</p>
            <WLink to="/report">Buat laporan</WLink>
          </WEmpty>
        )}
      {confirm && (
        <div className="w-dialog-backdrop">
          <section
            className="w-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Ajukan penghapusan laporan?</h2>
            <p>Posko akan memproses permintaanmu.</p>
            <WButton
              disabled={deleting}
              onClick={async () => {
                if (!selected) return;
                setDeleting(true);
                try {
                  await request(
                    (!selected.trackingToken && selected.residentId === residentId && residentId
                      ? '/resident/reports/'
                      : '/reports/') +
                      selected.id +
                      '/deletion-request',
                    ok,
                    {
                      method: 'POST',
                      headers: {
                        'X-CSRF-Token': residentCsrf(),
                        ...(selected.trackingToken
                          ? { 'X-Tracking-Token': selected.trackingToken }
                          : {}),
                      },
                    },
                  );
                  setMessage('Permintaan penghapusan diterima.');
                  setConfirm(false);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Permintaan belum terkirim.');
                  setConfirm(false);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Mengirim…' : 'Ajukan penghapusan'}
            </WButton>
            <WButton secondary onClick={() => setConfirm(false)}>
              Batal
            </WButton>
          </section>
        </div>
      )}
    </div>
  );
}
export function TrainingPage({ region }: { region: Region }) {
  const query = useQuery({
    queryKey: ['training', region.id],
    queryFn: () => request('/regions/' + region.id + '/training', z.array(trainingSchema)),
  });
  const [started, setStarted] = useState(false),
    [step, setStep] = useState(0),
    [answers, setAnswers] = useState<Record<number, number>>({}),
    [revealed, setRevealed] = useState(false),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{ score: number; total: number } | null>(null),
    [key, setKey] = useState(createUuid);
  const scenario = query.data?.[0],
    question = scenario?.content.steps[step];
  async function finish() {
    if (!scenario) return;
    setBusy(true);
    setMessage('');
    try {
      const score = await request(
        '/regions/' + region.id + '/training/' + scenario.id + '/results',
        z.object({ score: z.number(), total: z.number() }),
        {
          method: 'POST',
          body: {
            answers: scenario.content.steps.map((_, i) => answers[i] ?? -1),
            feedback: '',
            completionKey: key,
          },
        },
      );
      setResult(score);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hasil belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <p role="status">Memuat kuis…</p>;
  if (query.isError)
    return (
      <WEmpty title="Kuis belum dapat dimuat">
        <WButton secondary onClick={() => void query.refetch()}>
          Coba lagi
        </WButton>
      </WEmpty>
    );
  if (!scenario || !question) return <WEmpty title="Belum ada kuis untuk wilayah ini" />;
  if (result)
    return (
      <div>
        <h1>Hasil kuis</h1>
        <div className="w-result-layout">
          <section className="w-card w-score-card">
            <h2>{scenario.content.title}</h2>
            <strong className="w-score">
              {result.score} / {result.total}
            </strong>
            <p className="w-muted">jawaban benar</p>
            <WButton
              onClick={() => {
                setResult(null);
                setAnswers({});
                setStep(0);
                setRevealed(false);
                setKey(createUuid());
              }}
            >
              Ulangi kuis
            </WButton>
            <WLink secondary to="/guide">
              Kembali ke panduan
            </WLink>
          </section>
          <div className="w-answer-review">
            {scenario.content.steps.map((s, i) => (
              <section className="w-card w-stack" key={i}>
                <small>Pertanyaan {i + 1}</small>
                <h3>{s.question}</h3>
                <p>
                  <WIcon name="check" size={22} />
                  {s.options[s.answer]}
                </p>
                <small>{s.explanation}</small>
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  if (!started)
    return (
      <div className="w-narrow">
        <h1>{scenario.content.title}</h1>
        <section className="w-card w-stack">
          <span className="w-icon-tile">
            <WIcon name="book" size={32} />
          </span>
          <h2>{scenario.content.title}</h2>
          <p className="w-muted">{scenario.content.steps.length} pertanyaan</p>
          <WButton onClick={() => setStarted(true)}>Mulai kuis</WButton>
        </section>
      </div>
    );
  return (
    <div className="w-quiz">
      <h1>{scenario.content.title}</h1>
      <small>
        {step + 1} dari {scenario.content.steps.length}
      </small>
      <WProgress value={step + 1} total={scenario.content.steps.length} label="Progres kuis" />
      <h2>{question.question}</h2>
      <fieldset className="w-quiz-options">
        <legend className="sr-only">Pilih jawaban</legend>
        {question.options.map((option, i) => (
          <label className={'w-answer ' + (answers[step] === i ? 'is-selected' : '')} key={i}>
            <input
              type="radio"
              name={'question-' + step}
              value={i}
              checked={answers[step] === i}
              disabled={revealed}
              onChange={() => setAnswers({ ...answers, [step]: i })}
            />
            <strong>{option}</strong>
            <WIcon name="chevron" size={18} />
          </label>
        ))}
      </fieldset>
      {revealed && (
        <section className="w-card w-feedback">
          <h3>{answers[step] === question.answer ? 'Benar' : 'Lihat penjelasannya'}</h3>
          <p>{question.explanation}</p>
        </section>
      )}
      {message && <WError>{message}</WError>}
      <div className="w-mobile-action">
        <WButton
          disabled={answers[step] === undefined || busy}
          onClick={() => {
            if (!revealed) setRevealed(true);
            else if (step < scenario.content.steps.length - 1) {
              setStep(step + 1);
              setRevealed(false);
            } else void finish();
          }}
        >
          {busy
            ? 'Menyimpan…'
            : !revealed
              ? 'Pilih jawaban'
              : step < scenario.content.steps.length - 1
                ? 'Pertanyaan berikutnya'
                : 'Lihat hasil'}
        </WButton>
      </div>
    </div>
  );
}
