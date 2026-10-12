import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '@tandara/api-client';
import { AppShell, StatusCard } from '@tandara/ui';

const client = createApiClient({ baseUrl: import.meta.env['VITE_API_BASE_URL'] ?? '/api/v1' });

export function FoundationPage() {
  const system = useQuery({
    queryKey: ['system-info'],
    queryFn: ({ signal }) => client.getSystemInfo(signal),
  });
  return (
    <AppShell audience="Posko">
      <p className="eyebrow">Ruang kerja koordinator</p>
      <h1>Fondasi Tandara Posko</h1>
      <p className="intro">
        Kerangka dashboard siap untuk autentikasi, inbox laporan, dan peninjauan manusia. Halaman
        ini belum memuat data warga.
      </p>
      <div className="grid">
        <StatusCard title="Koneksi API">
          <p role="status">
            {system.isPending
              ? 'Memeriksa koneksi API…'
              : system.isError
                ? 'API belum terhubung.'
                : 'API terhubung · mode simulasi.'}
          </p>
          {system.isError && (
            <button
              onClick={() => {
                void system.refetch();
              }}
            >
              Coba lagi
            </button>
          )}
        </StatusCard>
        <StatusCard title="Batas akses">
          <p>
            Autentikasi dan izin akses harus tersedia sebelum endpoint atau tampilan data privat
            ditambahkan. Dashboard tidak memiliki cache service worker.
          </p>
        </StatusCard>
      </div>
      <p className="notice">
        AI hanya memberikan saran. Publikasi informasi tetap memerlukan peninjauan manusia.
      </p>
    </AppShell>
  );
}
