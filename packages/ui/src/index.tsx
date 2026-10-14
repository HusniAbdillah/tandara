import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  Home,
  Inbox,
  LifeBuoy,
  LogOut,
  Map,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from './lib/utils.js';
export { Button } from './components/button.js';
export type { ButtonProps } from './components/button.js';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card.js';
export { Input } from './components/input.js';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/select.js';
export { Separator } from './components/separator.js';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/table.js';
export { cn } from './lib/utils.js';

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
  const icons = {
    home: Home,
    plan: BookOpen,
    report: FileText,
    check: Check,
    training: GraduationCap,
    help: LifeBuoy,
    arrow: ArrowRight,
    pin: MapPin,
    wifi: Wifi,
    download: Download,
    inbox: Inbox,
    map: Map,
    source: ClipboardCheck,
    audit: FileText,
    settings: Settings,
    logout: LogOut,
    search: Search,
    shield: ShieldCheck,
  };
  const IconComponent = icons[name];
  return <IconComponent size={size} strokeWidth={1.8} aria-hidden="true" className={className} />;
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
    <div className="rounded-lg border border-dashed border-line px-5 py-9 text-center text-muted-foreground">
      <Icon name="inbox" size={28} className="mb-2.5 text-muted-foreground" />
      <h3 className="text-ink">{title}</h3>
      <p>{children}</p>
    </div>
  );
}
const badgeVariants = cva(
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 tracking-[0.05px] transition-colors focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-[#f2f4f1] text-[#53635d]',
        teal: 'border-[#c7ddd0] bg-[#edf5ef] text-[#185d4b]',
        amber: 'border-[#e7d3ae] bg-[#fff7e8] text-[#744b15]',
        red: 'border-[#e7c3be] bg-[#fff1ef] text-[#92372e]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);
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
      {hint && <small className="text-[13px] font-normal text-muted-foreground">{hint}</small>}
    </label>
  );
}
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'amber' | 'red';
  className?: string;
}) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
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
    <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-brand">{eyebrow}</p>
        <h1 className="mb-1 text-2xl font-semibold leading-tight tracking-[-0.65px] sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mb-0 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
