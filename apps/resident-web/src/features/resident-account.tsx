import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { residentCredentialsSchema, residentSessionSchema } from '@tandara/contracts';
import { WAvatar, WButton, WEmpty, WError, WIcon, WLink, WRow } from './chalk-ui.js';
import type { ResidentData } from './resident-data.js';
import { residentCsrf } from './resident-data.js';
import { residentDb } from '../offline/database.js';
import { returnPath } from '../account/session.js';

export function AccountForm({ register = false }: { register?: boolean }) {
  const navigate = useNavigate(),
    client = useQueryClient();
  const location = useLocation();
  const next = returnPath(new URLSearchParams(location.search).get('next'));
  const nextQuery = next ? '?next=' + encodeURIComponent(next) : '';
  const [phone, setPhone] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="w-auth" id="main">
      <form
        className="w-auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          const result = residentCredentialsSchema.safeParse({ phone, password });
          if (!result.success) {
            setError(result.error.issues[0]?.message ?? 'Periksa isian.');
            return;
          }
          setBusy(true);
          try {
            const session = await request(
              '/resident/auth/' + (register ? 'register' : 'login'),
              residentSessionSchema,
              { method: 'POST', body: result.data },
            );
            await client.cancelQueries({ queryKey: ['resident-session'] });
            client.setQueryData(['resident-session'], session);
            navigate(next ?? (register ? '/area' : '/'), { replace: true });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Tidak dapat masuk.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>{register ? 'Daftar' : 'Masuk'}</h1>
        <label className="w-field">
          <span>Nomor telepon</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xx xxxx xxxx"
            required
          />
        </label>
        <label className="w-field">
          <span>Kata sandi</span>
          <span className="w-password">
            <input
              type={show ? 'text' : 'password'}
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={8}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={register ? 'Buat kata sandi' : 'Masukkan kata sandi'}
              required
            />
            <button
              type="button"
              className="w-icon-button"
              aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              aria-pressed={show}
              onClick={() => setShow(!show)}
            >
              <WIcon name="eye" size={22} />
            </button>
          </span>
        </label>
        {register && <small className="w-muted">Minimal 8 karakter</small>}
        {error && <WError>{error}</WError>}
        <WButton type="submit" disabled={busy}>
          {busy ? 'Memproses…' : register ? 'Daftar' : 'Masuk'}
        </WButton>
        <p className="w-auth-switch">
          {register ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <Link to={(register ? '/login' : '/register') + nextQuery}>
            {register ? 'Masuk' : 'Daftar'}
          </Link>
        </p>
      </form>
    </main>
  );
}
export function ProfilePage({ app }: { app: ResidentData }) {
  const navigate = useNavigate(),
    client = useQueryClient();
  const [error, setError] = useState('');
  const profile = app.session.data?.user;
  return (
    <div className="w-profile">
      <h1>Profil</h1>
      <section className="w-card w-profile-identity">
        <WAvatar large />
        <h2>{profile?.name ?? 'Tandara Warga'}</h2>
        <p className="w-muted">{profile?.phone ?? app.region?.name}</p>
        {!profile && <WLink to="/login">Masuk</WLink>}
      </section>
      <div className="w-stack">
        <WRow
          to="/downloads"
          title="Unduhan"
          subtitle="Rencana dan daftar kebutuhan"
          icon="download"
        />
        <WRow
          to="/tracking"
          title="Laporan saya"
          subtitle="Laporan dan permintaan bantuan"
          icon="report"
        />
        <WRow to="/area" title="Wilayah" subtitle={app.region?.name} icon="pin" />
        <WRow to="/help" title="Data dan privasi" icon="shield" />
        {profile && (
          <WButton
            secondary
            onClick={async () => {
              try {
                await request('/resident/auth/logout', z.object({ ok: z.boolean() }), {
                  method: 'POST',
                  headers: { 'X-CSRF-Token': residentCsrf() },
                });
                client.removeQueries({ queryKey: ['resident-account-reports'] });
                client.removeQueries({ queryKey: ['resident-account-report'] });
                client.removeQueries({ queryKey: ['resident-personal-notifications'] });
                client.removeQueries({ queryKey: ['receipt'] });
                client.setQueryData(['resident-session'], { user: null });
                navigate('/login');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Belum dapat keluar.');
              }
            }}
          >
            Keluar
          </WButton>
        )}
        {error && <WError>{error}</WError>}
      </div>
    </div>
  );
}
export function AreaPage({ app }: { app: ResidentData }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const regions =
    app.regions.data?.filter((r) =>
      (r.name + ' ' + r.organization).toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <div className="w-narrow">
      <h1>Pilih wilayahmu</h1>
      <label className="w-search-field">
        <WIcon name="search" size={20} />
        <input
          aria-label="Cari wilayah"
          placeholder="Cari kelurahan atau RW"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="w-stack">
        {regions.map((region) => (
          <WRow
            key={region.id}
            title={region.name}
            subtitle={region.organization}
            icon="pin"
            selected={app.activeRegion === region.id}
            onClick={() => {
              app.choose(region.id);
              navigate('/');
            }}
          />
        ))}
      </div>
      {!regions.length && (
        <WEmpty title="Wilayah belum tersedia">
          <WButton secondary onClick={() => void app.regions.refetch()}>
            Coba lagi
          </WButton>
        </WEmpty>
      )}
    </div>
  );
}
export function PrivacyPage({ app }: { app: ResidentData }) {
  const [message, setMessage] = useState('');
  return (
    <div className="w-narrow">
      <h1>Data dan privasi</h1>
      <section className="w-card w-stack">
        <h2>Data laporan</h2>
        <p>
          Pengelola wilayah dapat melihat laporan, foto, lokasi dan kontak yang kamu kirim. Jika
          kamu masuk, nomor telepon akun ikut dikirim ke Posko bersama laporan. Ringkasan
          ditampilkan di peta setelah ditinjau Posko.
        </p>
        <p>
          Kontak dihapus setelah {app.region?.config.retentionDays ?? 30} hari. Draf yang belum
          terkirim dihapus setelah 7 hari.
        </p>
        <h2>Hapus laporan</h2>
        <p>Buka laporan di Laporan saya, lalu pilih Ajukan penghapusan.</p>
        <WLink secondary to="/tracking">
          Laporan saya
        </WLink>
        <h2>Data di perangkat</h2>
        <p>
          Unduhan, daftar kebutuhan dan tanda terima disimpan di perangkat ini. Hapus data hanya
          setelah menyimpan tanda terima yang masih dibutuhkan.
        </p>
        <WButton
          secondary
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
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key?.startsWith('tandara:checklist:')) localStorage.removeItem(key);
            }
            setMessage('Data di perangkat telah dihapus.');
          }}
        >
          Hapus data di perangkat
        </WButton>
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  );
}
