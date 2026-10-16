import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Icon } from '@tandara/ui';
import { designAssets } from './design-assets.js';

const iconAssets = {
  home: 'IconHouse',
  map: 'IconMap',
  shield: 'IconShieldCheck',
  report: 'IconFileText',
  pin: 'IconMapPin',
  bell: 'IconBell',
  help: 'IconHandHeart',
  check: 'IconCircleCheck',
  building: 'BuildingTeal',
  users: 'IconUsers',
  chevron: 'IconChevronRight',
  water: 'WaterTeal',
  arrow: 'IconArrowUpRight',
  plus: 'IconPlus',
  walk: 'IconFootprints',
  message: 'IconMessageCircle',
  camera: 'IconCamera',
  search: 'IconSearch',
  filter: 'IconSlidersHorizontal',
  locate: 'IconLocateFixed',
  back: 'IconArrowLeft',
  eye: 'IconEye',
  file: 'IconFileCheck',
} as const;
export type WargaIconName = keyof typeof iconAssets | 'download' | 'book' | 'close' | 'logout';
export function WIcon({ name, size = 24 }: { name: WargaIconName; size?: number }) {
  if (name === 'close')
    return (
      <span className="w-close" aria-hidden="true">
        ×
      </span>
    );
  if (name === 'download' || name === 'book' || name === 'logout')
    return <Icon name={name === 'book' ? 'plan' : name} size={size} />;
  const key = iconAssets[name] as keyof typeof designAssets;
  return (
    <img
      className="w-icon"
      src={'/design/' + designAssets[key]}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
export function WButton({
  children,
  secondary = false,
  quiet = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean; quiet?: boolean }) {
  return (
    <Button
      variant={quiet ? 'ghost' : secondary ? 'outline' : 'default'}
      className={`w-button ${secondary ? 'w-secondary' : ''} ${quiet ? 'w-quiet' : ''} ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}
export function WLink({
  children,
  to,
  secondary = false,
  className = '',
}: {
  children: ReactNode;
  to: string;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant={secondary ? 'outline' : 'default'}
      className={`w-button ${secondary ? 'w-secondary' : ''} ${className}`}
    >
      <Link to={to}>{children}</Link>
    </Button>
  );
}
export function WRow({
  title,
  subtitle,
  icon = 'report',
  to,
  onClick,
  selected = false,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  icon?: WargaIconName;
  to?: string;
  onClick?: () => void;
  selected?: boolean;
  children?: ReactNode;
}) {
  const content = (
    <>
      <span className="w-icon-tile">
        <WIcon name={icon} />
      </span>
      <span className="w-row-copy">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
        {children}
      </span>
      <WIcon name="chevron" size={18} />
    </>
  );
  const className = `w-row ${selected ? 'is-selected' : ''}`;
  return to ? (
    <Link className={className} to={to}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}
export function WProgress({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  return (
    <div
      className="w-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total || 1}
      aria-valuenow={value}
    >
      <span style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} />
    </div>
  );
}
export function WEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="w-empty">
      <span className="w-icon-tile">
        <WIcon name="report" />
      </span>
      <h2>{title}</h2>
      {children && <div className="w-muted">{children}</div>}
    </div>
  );
}
export function WError({ children }: { children: ReactNode }) {
  return (
    <p className="w-error" role="alert">
      {children}
    </p>
  );
}
export function WAvatar({ large = false }: { large?: boolean }) {
  return (
    <img
      className={`w-avatar ${large ? 'w-avatar-large' : ''}`}
      src={'/design/' + designAssets.Frame}
      width={large ? 72 : 32}
      height={large ? 72 : 32}
      alt="Profil"
    />
  );
}
export function WBrand() {
  return (
    <Link to="/" className="w-brand">
      <img src={'/design/' + designAssets.TandaraMark} width={36} height={36} alt="" />
      <span>tandara</span>
    </Link>
  );
}
