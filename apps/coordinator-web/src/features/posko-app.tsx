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
      <div className="posko-layout grid min-h-screen grid-cols-[224px_minmax(0,1fr)] max-[1100px]:grid-cols-[200px_minmax(0,1fr)] max-md:block print:block">
        <aside className="sidebar sticky top-0 flex h-screen flex-col border-r border-line bg-[#fcfdf9] px-[18px] py-7 max-md:static max-md:h-auto max-md:border-0 max-md:p-0 print:hidden">
          <Brand audience="Posko" className="mx-[10px] mb-[34px] max-md:hidden" />
          <p className="mb-2.5 ml-3 mr-3 mt-5 text-[10px] font-bold tracking-[1.5px] text-[#53665a] max-md:hidden">
            RUANG KOORDINASI
          </p>
          <nav
            className="flex flex-col gap-1 max-md:flex-row max-md:gap-1.5 max-md:overflow-x-auto max-md:border-b max-md:border-line max-md:px-4 max-md:py-2"
            aria-label="Navigasi Posko"
          >
            {nav.map(([url, label, icon]) => (
              <NavLink
                key={url}
                to={url}
                end={url === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-[11px] text-[13px] font-[550] text-muted no-underline max-md:min-h-11 max-md:whitespace-nowrap max-md:px-[9px] max-md:text-xs ${isActive ? 'bg-[#e5eee5] font-[650] text-brand' : ''}`
                }
              >
                <Icon name={icon} />
                {label}
              </NavLink>
            ))}
            {user.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-[11px] text-[13px] font-[550] text-muted no-underline max-md:min-h-11 max-md:whitespace-nowrap max-md:px-[9px] max-md:text-xs ${isActive ? 'bg-[#e5eee5] font-[650] text-brand' : ''}`
                }
              >
                <Icon name="settings" />
                Administrasi
              </NavLink>
            )}
          </nav>
          <div className="mt-auto border-t border-line px-2.5 pt-5 max-md:hidden">
            <p className="mb-1 text-xs">
              <strong>{user.name}</strong>
            </p>
            <p className="muted mb-1 text-xs">
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
          <header className="posko-header flex h-[78px] items-center justify-between gap-4 border-b border-line bg-[#fcfdf9] px-9 py-4 max-[1100px]:px-6 max-md:h-auto max-md:flex-wrap max-md:px-5 print:hidden">
            <label className="flex min-w-[180px] max-w-[330px] items-center gap-2.5 text-brand">
              <Icon name="pin" />
              <select
                aria-label="Wilayah Posko"
                value={region?.id ?? ''}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setMessage('');
                }}
                className="min-h-8 border-0 bg-transparent px-0 py-1 pr-6 text-[13px] font-semibold"
              >
                {available?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Icon name="shield" size={15} />
                Keputusan tetap pada manusia
              </span>
              {region?.simulation && <Badge tone="amber">SIMULASI</Badge>}
              <button
                className="quiet small hidden max-md:inline-flex"
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
          <main
            id="main"
            className="posko-main mx-auto max-w-[1600px] px-9 py-8 min-[1600px]:px-12 min-[1600px]:py-10 max-[1100px]:px-6 max-[1100px]:py-7 max-md:px-5 max-md:py-6 print:p-0"
            tabIndex={-1}
          >
            {message && <Notice>{message}</Notice>}
            <div key={region?.id}>{content}</div>
            <footer className="safe-footer print:hidden">
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
  const [needsCode, setNeedsCode] = useState(false);
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
              const message = err instanceof Error ? err.message : 'Tidak dapat masuk.';
              if (message.includes('Kode autentikator diperlukan')) {
                setNeedsCode(true);
                setError('Masukkan kode dari aplikasi autentikator untuk melanjutkan.');
              } else {
                setError(message);
              }
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
          {needsCode && (
            <Field label="Kode autentikator">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </Field>
          )}
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
