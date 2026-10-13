import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { deploymentSchema, regionSchema, userSchema } from '@tandara/contracts';
import type { Region, User } from '@tandara/contracts';
import { Brand, Badge, Field, Icon, Notice } from '@tandara/ui';
import { Inbox, Overview, ReportDetailPage } from './reports-ui.js';
import {
  PlansPage,
  AssistancePage,
  SourcesPage,
  AuditPage,
  TrainingManagement,
} from './management-ui.js';
import { SituationMap } from './situation-map.js';
import { AdminPage } from './admin-ui.js';
import { NotificationsPage } from './notifications-ui.js';
import { AiWorkspace } from './ai-ui.js';
import { AccountSecurity } from './security-ui.js';

const authSchema = z.object({ user: userSchema, csrf: z.string() });
const nav = [
  ['/', 'Ringkasan', 'home'],
  ['/inbox', 'Kotak laporan', 'inbox'],
  ['/map', 'Peta situasi', 'map'],
  ['/plans', 'Rencana lokal', 'plan'],
  ['/assistance', 'Tindak lanjut', 'help'],
  ['/training', 'Latihan', 'training'],
  ['/sources', 'Sumber informasi', 'source'],
  ['/ai', 'Asisten Posko', 'help'],
  ['/security', 'Keamanan akun', 'settings'],
  ['/audit', 'Jejak audit', 'audit'],
  ['/notifications', 'Pembaruan', 'source'],
] as const;
export function PoskoApp() {
  const client = useQueryClient();
  const path = useLocation().pathname;
  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: () => request('/auth/me', authSchema),
    retry: false,
    staleTime: 60000,
  });
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: () => request('/regions', z.array(regionSchema)),
  });
  const [selected, setSelected] = useState('');
  const deployment = useQuery({
    queryKey: ['deployment'],
    queryFn: () => request('/deployment', deploymentSchema),
  });
  const [message, setMessage] = useState('');
  const user = auth.data?.user;
  const available = regions.data?.filter(
    (r) => user?.role === 'admin' || user?.regionIds.includes(r.id),
  );
  const region = available?.find((r) => r.id === selected) ?? available?.[0];
  async function run(action: () => Promise<unknown>, success = 'Perubahan tersimpan.') {
    setMessage('');
    try {
      await action();
      setMessage(success);
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Permintaan gagal.');
      throw e;
    }
  }
  if (auth.isPending)
    return (
      <main className="loading" role="status">
        Memeriksa sesi…
      </main>
    );
  if (!user)
    return (
      <Login
        simulation={deployment.data?.mode === 'simulation'}
        residentOrigin={deployment.data?.residentOrigin}
        onLogin={(data) => client.setQueryData(['auth'], data)}
      />
    );
  let content;
  if (path === '/admin' && user.role === 'admin')
    content = <AdminPage user={user} region={region} regions={regions.data ?? []} run={run} />;
  else if (path === '/security') content = <AccountSecurity />;
  else if (!region)
    content = (
      <Notice tone="warning">Tidak ada wilayah aktif yang ditugaskan untuk akun ini.</Notice>
    );
  else if (path.startsWith('/reports/'))
    content = <ReportDetailPage id={path.split('/')[2]!} region={region} user={user} run={run} />;
  else
    switch (path) {
      case '/':
        content = <Overview region={region} user={user} />;
        break;
      case '/inbox':
        content = <Inbox region={region} user={user} />;
        break;
      case '/map':
        content = <SituationMap region={region} user={user} />;
        break;
      case '/plans':
        content = <PlansPage region={region} user={user} run={run} />;
        break;
      case '/assistance':
        content = <AssistancePage region={region} user={user} run={run} />;
        break;
      case '/sources':
        content = <SourcesPage region={region} user={user} run={run} />;
        break;
      case '/ai':
        content = <AiWorkspace region={region} user={user} run={run} />;
        break;
      case '/security':
        content = <AccountSecurity />;
        break;
      case '/audit':
        content = <AuditPage region={region} user={user} />;
        break;
      case '/notifications':
        content = <NotificationsPage region={region} user={user} run={run} />;
        break;
      case '/training':
        content = <TrainingManagement region={region} user={user} run={run} />;
        break;
      case '/admin':
        content =
          user.role === 'admin' ? (
            <AdminPage region={region} user={user} regions={regions.data ?? []} run={run} />
          ) : (
            <Notice tone="error">Halaman ini khusus administrator.</Notice>
          );
        break;
      default:
        content = <Notice>Halaman tidak ditemukan. Pilih menu untuk melanjutkan.</Notice>;
    }
  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <div className="posko-layout">
        <aside className="sidebar">
          <Brand audience="Posko" />
          <p className="nav-label">RUANG KOORDINASI</p>
          <nav aria-label="Navigasi Posko">
            {nav.map(([url, label, icon]) => (
              <NavLink key={url} to={url} end={url === '/'}>
                <Icon name={icon} />
                {label}
              </NavLink>
            ))}
            {user.role === 'admin' && (
              <NavLink to="/admin">
                <Icon name="settings" />
                Administrasi
              </NavLink>
            )}
          </nav>
          <div className="sidebar-bottom">
            <p>
              <strong>{user.name}</strong>
            </p>
            <p className="muted">
              {user.role === 'admin' ? 'Administrator' : 'Koordinator wilayah'}
            </p>
            <button
              className="quiet small"
              onClick={async () => {
                await request('/auth/logout', z.object({ ok: z.boolean() }), { method: 'POST' });
                client.clear();
                window.location.assign('/');
              }}
            >
              <Icon name="logout" size={16} />
              Keluar
            </button>
          </div>
        </aside>
        <div>
          <header className="posko-header">
            <label className="region-select">
              <Icon name="pin" />
              <select
                aria-label="Wilayah Posko"
                value={region?.id ?? ''}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setMessage('');
                }}
              >
                {available?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <span className="connection">
                <Icon name="shield" size={15} />
                Keputusan tetap pada manusia
              </span>
              {region?.simulation && <Badge tone="amber">SIMULASI</Badge>}
              <button
                className="quiet small mobile-logout"
                onClick={async () => {
                  await request('/auth/logout', z.object({ ok: z.boolean() }), { method: 'POST' });
                  client.clear();
                  window.location.assign('/');
                }}
              >
                Keluar
              </button>
            </div>
          </header>
          <main id="main" className="posko-main" tabIndex={-1}>
            {message && <Notice>{message}</Notice>}
            <div key={region?.id}>{content}</div>
            <footer className="safe-footer">
              <p>
                {region?.simulation ? 'Simulasi — bukan kejadian nyata. ' : ''}Laporan komunitas dan
                saran AI bukan peringatan resmi. Area tanpa informasi tidak berarti aman.
              </p>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
function Login({
  onLogin,
  simulation,
  residentOrigin,
}: {
  onLogin: (data: z.infer<typeof authSchema>) => void;
  simulation: boolean;
  residentOrigin: string | undefined;
}) {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-layout">
      <section className="login-story">
        <p className="eyebrow">TANDARA / RUANG KOORDINASI</p>
        <h1>
          Dari kabar lokal,
          <br />
          ke kesiapan bersama.
        </h1>
        <p>
          Tinjau laporan warga, pahami informasi yang belum lengkap, dan kelola rencana komunitas
          dengan keputusan yang dapat ditelusuri.
        </p>
        <Badge tone="amber">
          {simulation ? 'Lingkungan simulasi · ' : ''}Bukan layanan darurat
        </Badge>
      </section>
      <main className="login-form">
        <Brand audience="Posko" />
        <h1>Masuk ke Posko</h1>
        <p className="muted">Akses untuk koordinator dan administrator berwenang.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              onLogin(
                await request('/auth/login', authSchema, {
                  method: 'POST',
                  body: { email, password, ...(code ? { code } : {}) },
                }),
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Tidak dapat masuk.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Kata sandi">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Kode autentikator (jika diaktifkan)">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <button className="primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Memeriksa…' : 'Masuk'}
            <Icon name="arrow" />
          </button>
        </form>
        <p className="meta">
          Gunakan akun {simulation ? 'simulasi ' : ''}yang diberikan pengelola lingkungan ini.
        </p>
        {residentOrigin && <a href={residentOrigin}>Buka Tandara Warga →</a>}
      </main>
    </div>
  );
}
export interface ManagementProps {
  region: Region;
  user: User;
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
}
