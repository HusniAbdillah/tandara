import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { WAvatar, WBrand, WButton, WEmpty, WIcon, WLink, WProgress, WRow } from './chalk-ui.js';
import type { WargaIconName } from './chalk-ui.js';
import { useChecklist, useDesktop, useResidentData } from './resident-data.js';
import type { ResidentData } from './resident-data.js';
import { MapPage, StreetMap, planPoints } from './resident-map.js';
import { AccountForm, AreaPage, PrivacyPage, ProfilePage } from './resident-account.js';
import { PreparednessPage } from './resident-preparedness.js';
import { ReportForm, TrackingPage, TrainingPage } from './resident-workflows.js';
import { designAssets } from './design-assets.js';
import './warga.css';
import { PersonalNotifications } from './resident-notifications.js';

const destinations: { to: string; label: string; icon: WargaIconName; matches: string[] }[] = [
  { to: '/', label: 'Beranda', icon: 'home', matches: ['/'] },
  { to: '/map', label: 'Peta', icon: 'map', matches: ['/map'] },
  {
    to: '/guide',
    label: 'Panduan',
    icon: 'shield',
    matches: ['/guide', '/plan', '/checklist', '/downloads', '/training'],
  },
  {
    to: '/tracking',
    label: 'Laporan saya',
    icon: 'report',
    matches: ['/tracking', '/report', '/support'],
  },
];
export function ResidentApp() {
  const app = useResidentData(),
    location = useLocation(),
    desktop = useDesktop(),
    navigate = useNavigate();
  const path = location.pathname;
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const handler = (event: Event) =>
      setUpdate(() => (event as CustomEvent<() => Promise<void>>).detail);
    window.addEventListener('tandara:update-available', handler);
    return () => window.removeEventListener('tandara:update-available', handler);
  }, []);
  useEffect(() => {
    if (path !== '/map') window.scrollTo(0, 0);
  }, [path]);
  if (path === '/login' || path === '/register')
    return (
      <div className="warga-app">
        <AccountForm register={path === '/register'} />
      </div>
    );
  const mapPage = path === '/map';
  const formPage = path === '/report' || path === '/support' || path === '/training';
  const showMobileHeader = !formPage && !['/area', '/profile', '/help'].includes(path);
  let content;
  if (path === '/area') content = <AreaPage app={app} />;
  else if (path === '/profile') content = <ProfilePage app={app} />;
  else if (path === '/help') content = <PrivacyPage app={app} />;
  else if (path === '/tracking') content = <TrackingPage app={app} />;
  else if (mapPage) content = <MapPage app={app} />;
  else if ((app.regions.isError || app.data.isError) && !app.region)
    content = (
      <WEmpty title="Informasi wilayah belum dapat dimuat">
        <WButton
          secondary
          onClick={() => {
            void app.regions.refetch();
            void app.data.refetch();
          }}
        >
          Coba lagi
        </WButton>
        <WLink secondary to="/area">
          Pilih wilayah
        </WLink>
      </WEmpty>
    );
  else if (!app.region)
    content = (
      <div className="w-loading" role="status">
        Memuat wilayah…
      </div>
    );
  else if (path === '/report' || path === '/support')
    content = (
      <ReportForm
        key={app.activeRegion + path}
        region={app.region}
        online={app.online}
        residentId={app.session.data?.user?.id}
      />
    );
  else if (path === '/training')
    content = <TrainingPage key={app.activeRegion} region={app.region} />;
  else if (['/guide', '/plan', '/checklist', '/downloads'].includes(path))
    content = <PreparednessPage app={app} view={path} />;
  else if (path === '/notifications') content = <UpdatesPage app={app} />;
  else if (path === '/contacts') content = <ContactsPage app={app} />;
  else if (path === '/welcome')
    content = (
      <div className="w-narrow w-stack">
        <h1>Peta dan bantuan di wilayahmu</h1>
        <p>Lihat lokasi, laporkan kejadian, dan baca rencana lingkunganmu.</p>
        <WLink to="/area">Pilih wilayah</WLink>
        <WLink secondary to="/login">
          Masuk
        </WLink>
      </div>
    );
  else if (path === '/') content = <Home app={app} />;
  else
    content = (
      <WEmpty title="Halaman tidak ditemukan">
        <WLink to="/">Buka beranda</WLink>
      </WEmpty>
    );
  const utility = (
    <div className="w-header-actions">
      <Link className="w-icon-button" to="/notifications" aria-label="Notifikasi">
        <WIcon name="bell" />
        {!!app.notifications.data?.unreadCount && app.session.data?.user && (
          <span className="w-notification-count">
            {app.notifications.data.unreadCount > 99 ? '99+' : app.notifications.data.unreadCount}
          </span>
        )}
      </Link>
      <Link className="w-icon-button" to="/profile" aria-label="Profil">
        <WAvatar />
      </Link>
    </div>
  );
  return (
    <div
      className={`warga-app ${mapPage ? 'warga-map-route' : ''} ${formPage ? 'warga-form-route' : ''}`}
    >
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <aside className="w-sidebar">
        <WBrand />
        <small>WARGA</small>
        <nav aria-label="Navigasi desktop warga">
          {destinations.map((item) => (
            <NavLink
              to={item.to}
              end={item.to === '/'}
              key={item.to}
              className={item.matches.includes(path) ? 'is-active' : ''}
            >
              <WIcon name={item.icon} size={22} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="w-main-shell">
        {(!mapPage || !desktop) && (desktop || showMobileHeader) && (
          <header className="w-topbar">
            {!desktop && (
              <Link to="/" aria-label="Tandara beranda">
                <img src={'/design/' + designAssets.TandaraMark} width={32} height={32} alt="" />
              </Link>
            )}
            <label className="w-location-select">
              {desktop && <WIcon name="pin" size={20} />}
              <span className="sr-only">Wilayah</span>
              <select
                aria-label="Wilayah"
                value={app.activeRegion}
                onChange={(e) => app.choose(e.target.value)}
              >
                {app.regions.data?.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              {!desktop && <small>{app.region?.organization ?? 'Tandara Warga'}</small>}
            </label>
            {utility}
          </header>
        )}
        {!desktop && !showMobileHeader && !formPage && (
          <div className="w-mobile-back">
            <button className="w-icon-button" aria-label="Kembali" onClick={() => navigate(-1)}>
              <WIcon name="back" />
            </button>
            <strong>
              {path === '/profile'
                ? 'Profil'
                : path === '/area'
                  ? 'Pilih wilayah'
                  : 'Data dan privasi'}
            </strong>
          </div>
        )}
        {mapPage && desktop && <div className="w-map-utilities">{utility}</div>}
        <main id="main" tabIndex={-1} className={mapPage ? 'w-main w-main-map' : 'w-main'}>
          {!app.online && (
            <div className="w-connection-state" role="status">
              Tanpa internet · Menampilkan unduhan
            </div>
          )}
          {update && (
            <div className="w-update" role="status">
              <span>Versi baru tersedia</span>
              <WButton secondary onClick={() => void update()}>
                Perbarui
              </WButton>
            </div>
          )}
          {content}
        </main>
      </div>
      {(!formPage || desktop) && (
        <nav className="w-bottom-nav" aria-label="Navigasi warga">
          {destinations.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={item.matches.includes(path) ? 'is-active' : ''}
              aria-current={item.matches.includes(path) ? 'page' : undefined}
            >
              <WIcon name={item.icon} size={22} />
              <span>{item.label === 'Laporan saya' ? 'Laporan' : item.label}</span>
              <i />
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
function Home({ app }: { app: ResidentData }) {
  const navigate = useNavigate();
  const desktop = useDesktop(),
    checklist = useChecklist(app.plan);
  const points = useMemo(() => planPoints(app.plan), [app.plan]);
  const news = app.data.data?.information.slice(0, 2) ?? [];
  const actions: { title: string; subtitle: string; icon: WargaIconName; to: string }[] = [
    {
      title: 'Buat laporan',
      subtitle: 'Laporkan kejadian di sekitar',
      icon: desktop ? 'report' : 'plus',
      to: '/report',
    },
    { title: 'Minta bantuan', subtitle: 'Kirim kebutuhan ke Posko', icon: 'help', to: '/support' },
    ...(desktop
      ? [
          {
            title: 'Laporan saya',
            subtitle: 'Lihat status laporan dan bantuan',
            icon: 'file' as const,
            to: '/tracking',
          },
        ]
      : []),
  ];
  const map = (
    <div className="w-home-map-card">
      <div className="w-home-map-heading">
        <h2>Peta sekitar</h2>
        <Link to="/map">Buka peta</Link>
      </div>
      <div className="w-home-map">
        <StreetMap
          compact
          region={app.region}
          points={points}
          onSelect={(id) => navigate('/map?panel=place&id=' + id)}
        />
        <Link to="/map" className="w-open-map" aria-label="Buka peta">
          Buka peta
          <WIcon name="arrow" size={16} />
        </Link>
      </div>
    </div>
  );
  const checklistCard = (
    <section className="w-card w-home-checklist">
      <h2>Daftar kebutuhan keluarga</h2>
      <p className="w-muted">
        {checklist.count} dari {checklist.total} dicentang
      </p>
      <WProgress
        value={checklist.count}
        total={checklist.total}
        label="Daftar kebutuhan keluarga"
      />
      <WLink secondary to="/checklist">
        Lihat daftar kebutuhan
      </WLink>
    </section>
  );
  const updates = (
    <section className="w-card w-home-updates">
      <div className="w-section-heading">
        <h2>Kabar sekitar</h2>
        {!desktop && <Link to="/notifications">Lihat semua</Link>}
      </div>
      {app.plan && (
        <WRow title={app.plan.content.title} subtitle="Rencana dari Posko" to="/plan" icon="file" />
      )}
      {news.slice(0, 1).map((item) => (
        <WRow
          key={item.id}
          title={item.title}
          subtitle={item.sourceName}
          to={'/notifications?id=' + item.id}
          icon="report"
        />
      ))}
      {!app.plan && !news.length && <p className="w-muted">Belum ada kabar terbaru.</p>}
    </section>
  );
  return (
    <div className="w-home">
      <h1>
        {desktop ? (
          app.region?.name
        ) : (
          <>
            Peta dan bantuan
            <br />
            {app.region?.name}
          </>
        )}
      </h1>
      {!desktop && map}
      <div className="w-home-actions">
        {actions.map((action) => (
          <Link key={action.to} to={action.to} className="w-home-action">
            <WIcon name={action.icon} size={desktop ? 28 : 24} />
            <span>
              <strong>{action.title}</strong>
              {desktop && <small>{action.subtitle}</small>}
            </span>
          </Link>
        ))}
      </div>
      {desktop ? (
        <div className="w-home-grid">
          {map}
          <div className="w-home-side">
            {updates}
            {checklistCard}
          </div>
        </div>
      ) : (
        <>
          {checklistCard}
          {updates}
        </>
      )}
    </div>
  );
}
function UpdatesPage({ app }: { app: ResidentData }) {
  const params = new URLSearchParams(useLocation().search);
  const selected = params.get('id');
  const items =
    app.data.data?.information.filter((item) => !selected || item.id === selected) ?? [];
  return (
    <div className="w-narrow">
      <h1>Notifikasi</h1>
      {app.session.data?.user && <PersonalNotifications app={app} />}
      <h2>Kabar sekitar</h2>
      <div className="w-stack">
        {items.map((item) => (
          <article className="w-card w-stack" key={item.id}>
            <small>{item.sourceName}</small>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <dl className="w-source-times">
              <div>
                <dt>Diterbitkan</dt>
                <dd>
                  {item.issuedAt
                    ? new Date(item.issuedAt).toLocaleString('id-ID')
                    : 'Belum tersedia'}
                </dd>
              </div>
              <div>
                <dt>Diambil dari sumber</dt>
                <dd>{new Date(item.fetchedAt).toLocaleString('id-ID')}</dd>
              </div>
              {item.expiresAt && (
                <div>
                  <dt>Berlaku sampai</dt>
                  <dd>{new Date(item.expiresAt).toLocaleString('id-ID')}</dd>
                </div>
              )}
            </dl>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
              Lihat sumber
              <WIcon name="arrow" size={16} />
            </a>
          </article>
        ))}
        {!items.length && <WEmpty title="Belum ada kabar terbaru" />}
      </div>
    </div>
  );
}
function ContactsPage({ app }: { app: ResidentData }) {
  return (
    <div className="w-narrow">
      <h1>Kontak wilayah</h1>
      <div className="w-stack">
        {app.region?.config.contacts.map((contact) => (
          <section className="w-card w-stack" key={contact.name}>
            <h2>{contact.name}</h2>
            <p>{contact.channel}</p>
            <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
              Lihat sumber kontak
            </a>
          </section>
        ))}
        {!app.region?.config.contacts.length && <WEmpty title="Belum ada kontak wilayah" />}
        <WLink to="/support">Minta bantuan Posko</WLink>
      </div>
    </div>
  );
}
