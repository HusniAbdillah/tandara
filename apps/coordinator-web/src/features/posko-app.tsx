import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { deploymentSchema, regionSchema, userSchema } from '@tandara/contracts';
import type { Region, User } from '@tandara/contracts';
import {
  Brand,
  DemoAccountPicker,
  Button,
  Field,
  Icon,
  Notice,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tandara/ui';
import {
  OperationsOverview,
  OperationsInbox,
  OperationsDetail,
  AnalyticsPage,
  TeamPage,
} from './operations-ui.js';
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
  ['/inbox', 'Laporan', 'inbox'],
  ['/ai', 'Asisten AI & RAG', 'shield'],
  ['/review', 'Tinjau hasil', 'shield'],
  ['/members', 'Anggota & peran', 'help'],
  ['/analytics', 'Rekap laporan', 'report'],
  ['/map', 'Peta situasi', 'map'],
  ['/plans', 'Rencana lokal', 'plan'],
  ['/training', 'Latihan warga', 'plan'],
  ['/assistance', 'Permintaan bantuan', 'help'],
  ['/sources', 'Sumber informasi', 'source'],
  ['/audit', 'Riwayat aktivitas', 'audit'],
  ['/settings', 'Pengaturan', 'settings'],
] as const;
export function PoskoApp() {
  const client = useQueryClient(),
    location = useLocation(),
    path = location.pathname;
  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: () => request('/auth/me', authSchema),
    retry: false,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: () => request('/regions', z.array(regionSchema)),
  });
  const deployment = useQuery({
    queryKey: ['deployment'],
    queryFn: () => request('/deployment', deploymentSchema),
  });
  const [selected, setSelected] = useState(''),
    [message, setMessage] = useState(''),
    [failure, setFailure] = useState(false),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const user = auth.data?.user;
  const available = regions.data?.filter(
    (r) => user?.role === 'admin' || user?.regionIds.includes(r.id),
  );
  const region = available?.find((r) => r.id === selected) ?? available?.[0];
  async function run(action: () => Promise<unknown>, success = 'Perubahan tersimpan.') {
    setMessage('');
    try {
      await action();
      setFailure(false);
      setMessage(success);
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    } catch (e) {
      setFailure(true);
      setMessage(e instanceof Error ? e.message : 'Permintaan gagal. Coba lagi.');
      throw e;
    }
  }
  async function logout() {
    try {
      await request('/auth/logout', z.object({ ok: z.boolean() }), { method: 'POST' });
      client.clear();
      window.location.assign('/');
    } catch (e) {
      setFailure(true);
      setMessage(e instanceof Error ? e.message : 'Tidak dapat keluar.');
    }
  }
  if (auth.isPending)
    return (
      <main className="loading" role="status">
        Memeriksa sesi�
      </main>
    );
  if (!user)
    return (
      <>
        <Login
          residentOrigin={deployment.data?.residentOrigin}
          demoLogin={deployment.data?.demoLogin}
          onLogin={(data) => client.setQueryData(['auth'], data)}
        />
        <PwaUpdateNotice />
      </>
    );
  const admin = user.role === 'admin';
  let content;
  if (path === '/security') content = <AccountSecurity />;
  else if (['/admin', '/settings', '/members'].includes(path) && admin)
    content = (
      <AdminPage
        key={path}
        initialTab={path === '/members' ? 'users' : path === '/settings' ? 'regions' : 'operations'}
        region={region}
        user={user}
        regions={regions.data ?? []}
        run={run}
      />
    );
  else if (!region)
    content = (
      <Notice tone="warning">
        {regions.isError
          ? 'Wilayah belum dapat dimuat. Periksa koneksi dan coba lagi.'
          : 'Belum ada wilayah yang ditugaskan untuk akun ini.'}
        <Button onClick={() => void regions.refetch()}>Muat ulang</Button>
      </Notice>
    );
  else {
    const props = { region, user, run };
    if (path.startsWith('/reports/'))
      content = <OperationsDetail key={path} id={path.split('/')[2]!} {...props} />;
    else
      switch (path) {
        case '/':
          content = <OperationsOverview {...props} />;
          break;
        case '/inbox':
          content = <OperationsInbox {...props} />;
          break;
        case '/review':
          content = admin ? (
            <ReviewQueue {...props} />
          ) : (
            <Notice tone="error">Persetujuan hasil hanya dapat dilakukan Admin.</Notice>
          );
          break;
        case '/analytics':
          content = <AnalyticsPage {...props} />;
          break;
        case '/members':
          content = <TeamPage {...props} />;
          break;
        case '/map':
          content = <SituationMap {...props} />;
          break;
        case '/plans':
          content = <PlansPage {...props} />;
          break;
        case '/training':
          content = <TrainingManagement {...props} />;
          break;
        case '/assistance':
          content = <AssistancePage {...props} />;
          break;
        case '/sources':
          content = <SourcesPage {...props} />;
          break;
        case '/audit':
          content = <AuditPage {...props} />;
          break;
        case '/notifications':
          content = <NotificationsPage {...props} />;
          break;
        case '/ai':
          content = <AiWorkspace {...props} />;
          break;
        case '/settings':
          content = (
            <>
              <header className="p-page-heading">
                <div>
                  <h1>Pengaturan akun</h1>
                  <p>
                    {user.name} � {region.name}
                  </p>
                </div>
              </header>
              <AccountSecurity />
              <NotificationsPage {...props} />
            </>
          );
          break;
        case '/admin':
          content = <Notice tone="error">Halaman ini hanya dapat diakses Admin.</Notice>;
          break;
        default:
          content = (
            <div className="p-card p-card-pad">
              <h1>Halaman tidak ditemukan</h1>
              <Button asChild>
                <Link to="/">Kembali ke ringkasan</Link>
              </Button>
            </div>
          );
      }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <div className="p-shell">
        <aside className={'p-sidebar ' + (menu ? 'is-open' : '')}>
          <Brand audience="Posko" />
          <div className="p-sidebar-context">{region?.name ?? 'Tandara Posko'}</div>
          <nav aria-label="Navigasi Posko">
            {nav
              .filter(([url]) => admin || url !== '/review')
              .map(([url, label, icon]) => (
                <NavLink key={url} to={url} end={url === '/'} onClick={() => setMenu(false)}>
                  <Icon name={icon} />
                  <span>{url === '/members' && !admin ? 'Tim wilayah' : label}</span>
                </NavLink>
              ))}
          </nav>
          <div className="p-profile">
            <span className="p-avatar">{user.name[0]}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{admin ? 'Admin' : 'Koordinator'}</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Keluar"
              title="Keluar"
              onClick={() => void logout()}
            >
              <Icon name="logout" />
            </Button>
          </div>
        </aside>
        {menu && (
          <button
            className="p-menu-backdrop"
            aria-label="Tutup menu"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="p-workspace">
          <header className="p-topbar">
            <Brand audience="Posko" />
            <div className="p-region">
              <Icon name="pin" size={18} />
              <Select value={region?.id ?? ''} onValueChange={setSelected}>
                <SelectTrigger aria-label="Wilayah Posko">
                  <SelectValue placeholder="Pilih wilayah" />
                </SelectTrigger>
                <SelectContent>
                  {available?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-top-actions">
              <Button asChild variant="ghost" size="icon">
                <Link to="/notifications" aria-label="Notifikasi" title="Notifikasi">
                  <Icon name="inbox" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon">
                <Link to="/security" aria-label="Keamanan akun" title="Keamanan akun">
                  <Icon name="shield" />
                </Link>
              </Button>
              <span className="p-avatar">{user.name[0]}</span>
            </div>
          </header>
          <main id="main" className="p-main" tabIndex={-1}>
            <div key={region?.id}>{content}</div>
          </main>
        </div>
      </div>
      <nav className="p-bottom-nav" aria-label="Navigasi mobile">
        {(
          [
            ['/', 'Ringkasan', 'home'],
            ['/inbox', 'Laporan', 'inbox'],
            ['/analytics', 'Rekap', 'report'],
            ['/notifications', 'Notifikasi', 'source'],
          ] as const
        ).map(([url, label, icon]) => (
          <NavLink to={url} end={url === '/'} key={url} aria-label={label} title={label}>
            <Icon name={icon} size={23} />
          </NavLink>
        ))}
        <button
          aria-label={menu ? 'Tutup menu' : 'Menu lainnya'}
          aria-expanded={menu}
          title="Menu lainnya"
          onClick={() => setMenu(!menu)}
        >
          <Icon name="settings" size={23} />
        </button>
      </nav>
      {message && (
        <div
          className={'p-toast ' + (failure ? 'is-error' : '')}
          role={failure ? 'alert' : 'status'}
        >
          <Icon name={failure ? 'help' : 'check'} />
          <span>{message}</span>
          <button aria-label="Tutup notifikasi" onClick={() => setMessage('')}>
            �
          </button>
        </div>
      )}
      <PwaUpdateNotice />
    </>
  );
}
function ReviewQueue(props: ManagementProps) {
  return <OperationsInbox {...props} />;
}

function PwaUpdateNotice() {
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    const onUpdateAvailable = (event: Event) => {
      setApplyUpdate(() => (event as CustomEvent<() => void>).detail);
    };

    window.addEventListener('tandara:update-available', onUpdateAvailable);
    return () => {
      window.removeEventListener('tandara:update-available', onUpdateAvailable);
    };
  }, []);

  if (!applyUpdate) return null;
  return (
    <div className="pwa-update-notice" role="status">
      <span>Pembaruan Posko tersedia.</span>
      <Button size="sm" onClick={applyUpdate}>
        Perbarui
      </Button>
    </div>
  );
}

function Login({
  onLogin,
  residentOrigin,
  demoLogin,
}: {
  onLogin: (data: z.infer<typeof authSchema>) => void;
  residentOrigin: string | undefined;
  demoLogin: z.infer<typeof deploymentSchema>['demoLogin'];
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
        <Brand audience="Posko" className="login-brand" />
        <p className="eyebrow">Tandara Posko</p>
        <h1>Laporan warga, ditangani bersama.</h1>
        <p>
          Tinjau laporan warga, pahami informasi yang belum lengkap, dan kelola rencana komunitas
          dengan keputusan yang dapat ditelusuri.
        </p>
      </section>
      <main className="login-form">
        <h1>Masuk ke Posko</h1>
        <p className="muted">Akses untuk koordinator dan administrator berwenang.</p>
        {demoLogin && (
          <DemoAccountPicker
            disabled={busy}
            accounts={demoLogin.coordinators.map((account) => ({
              ...account,
              identifier: account.email,
              role: account.role === 'admin' ? 'Administrator' : 'Koordinator wilayah',
            }))}
            selectedId={
              password === demoLogin.password
                ? demoLogin.coordinators.find((account) => account.email === email)?.id
                : undefined
            }
            onSelect={(id) => {
              const account = demoLogin.coordinators.find((account) => account.id === id);
              if (!account) return;
              setEmail(account.email);
              setPassword(demoLogin.password);
              setCode('');
              setNeedsCode(false);
              setError('');
            }}
          />
        )}
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
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Gunakan akun yang diberikan pengelola lingkungan ini.
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
