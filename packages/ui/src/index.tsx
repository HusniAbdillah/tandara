import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/** Generate a UUID in browsers that lack randomUUID outside secure contexts. */
export function createUuid(): string {
  const secureCrypto = globalThis.crypto;
  if (typeof secureCrypto.randomUUID === 'function') return secureCrypto.randomUUID();

  const bytes = secureCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function Icon({
  name,
  size = 20,
  className,
}: {
  name:
    | 'home'
    | 'plan'
    | 'report'
    | 'check'
    | 'training'
    | 'help'
    | 'arrow'
    | 'pin'
    | 'wifi'
    | 'download'
    | 'inbox'
    | 'map'
    | 'source'
    | 'audit'
    | 'settings'
    | 'logout'
    | 'search'
    | 'shield';
  size?: number;
  className?: string;
}) {
  const paths: Record<typeof name, string> = {
    home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8',
    plan: 'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6',
    report: 'M12 3v12M6 9l6-6 6 6M4 15v6h16v-6',
    check: 'm4 12 5 5L20 6',
    training: 'm2 9 10-5 10 5-10 5zM6 11v6c4 3 8 3 12 0v-6M22 9v8',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    pin: 'M12 22s8-8 8-14a8 8 0 1 0-16 0c0 6 8 14 8 14M12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    wifi: 'M3 8c5-5 13-5 18 0M6 12c3-3 9-3 12 0M9 16c2-2 4-2 6 0M12 20h.01',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    inbox: 'M5 4h14l3 12v5H2v-5zM2 16h6l2 3h4l2-3h6',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16',
    source: 'M4 5h16v14H4zM8 9h8M8 13h5M8 17h3',
    audit: 'M5 3h14v18H5zM9 7h6M9 11h6M9 15h4',
    settings:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    logout: 'M9 3H3v18h6M8 12h13m-5-5 5 5-5 5',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
    shield: 'M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6zM8 12l3 3 5-6',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Brand({ audience, className = '' }: { audience: string; className?: string }) {
  return (
    <a href="/" className={`brand ${className}`} aria-label={'Tandara ' + audience + ', beranda'}>
      <img src="/icon.svg" width="36" height="36" alt="" className="shrink-0" />
      <span>
        tandara<span className="brand-audience">{audience}</span>
      </span>
    </a>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'error' | 'success';
}) {
  return (
    <div
      className={`my-4 border-l-[3px] px-4 py-3 text-sm ${
        tone === 'warning'
          ? 'border-amber bg-[#fff3db] text-[#674719]'
          : tone === 'error'
            ? 'border-red bg-[#fff0ec] text-[#92372e]'
            : tone === 'success'
              ? 'border-brand bg-[#e3f1e5] text-[#185d4b]'
              : 'border-brand bg-[#eaf2ec] text-[#2b5245]'
      }`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-5 py-9 text-center text-muted">
      <Icon name="inbox" size={28} className="mb-2.5 text-muted" />
      <h3 className="text-ink">{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-[18px] flex flex-col gap-1.5">
      <span>{label}</span>
      {children}
      {hint && <small className="text-[13px] font-normal text-muted">{hint}</small>}
    </label>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'amber' | 'red';
}) {
  const toneClasses = {
    neutral: 'border-line bg-[#f0f2ed] text-[#4e6059]',
    teal: 'border-[#bdd8c7] bg-[#e9f3ec] text-[#185d4b]',
    amber: 'border-[#e4cfac] bg-[#fff3dc] text-[#744b15]',
    red: 'border-[#e4b8b0] bg-[#fff0ee] text-[#98372f]',
  };
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-normal rounded-[4px] border px-[7px] py-[3px] text-[11px] font-semibold tracking-[0.15px] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex items-center justify-between gap-6">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="lead">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function formatTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value)) + ' WIB'
    : 'Tidak diketahui';
}

export function AppShell({
  audience,
  children,
}: {
  audience: 'Warga' | 'Posko';
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label={`Tandara ${audience}, beranda`}>
          <img src="/icon.svg" width="36" height="36" alt="" className="shrink-0" />
          <span>
            Tandara <small>{audience}</small>
          </span>
        </a>
        <Badge>Simulasi</Badge>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer>Tandara mendukung kesiapsiagaan komunitas. Ikuti arahan otoritas resmi.</footer>
    </>
  );
}

export function StatusCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
