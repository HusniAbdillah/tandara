import type { ReactNode } from 'react';

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
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>
            Tandara <small>{audience}</small>
          </span>
        </a>
        <span className="badge">Simulasi</span>
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
