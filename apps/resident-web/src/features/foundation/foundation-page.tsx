import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '@tandara/api-client';
import { AppShell, StatusCard } from '@tandara/ui';
import { useOnlineStatus } from '../../offline/use-online-status.js';

const client = createApiClient({ baseUrl: import.meta.env['VITE_API_BASE_URL'] ?? '/api/v1' });

export function FoundationPage() {
  const isOnline = useOnlineStatus();
  const system = useQuery({
    queryKey: ['system-info'],
    queryFn: ({ signal }) => client.getSystemInfo(signal),
  });
  return (
    <AppShell audience="Warga">
      <p className="eyebrow">Dari informasi lokal menuju kesiapsiagaan bersama</p>
      <h1>Fondasi Tandara Warga</h1>
      <p className="intro">
        Kerangka aplikasi warga siap dikembangkan. Rencana lokal, checklist, dan pelaporan akan
        ditambahkan dalam tahap berikutnya.
      </p>
      <div className="grid">
        <StatusCard title="Koneksi aplikasi">
          <p role="status">
            {!isOnline || system.fetchStatus === 'paused'
              ? 'Offline — Anda melihat app shell tersimpan.'
              : system.isPending
                ? 'Memeriksa koneksi API…'
                : system.isError
                  ? 'API belum terhubung. Periksa layanan lokal.'
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
        <StatusCard title="Informasi tersimpan">
          <p>
            App shell tersedia offline setelah build dan kunjungan pertama. Penyimpanan rencana dan
            sinkronisasi laporan belum diimplementasikan.
          </p>
        </StatusCard>
      </div>
      <p className="notice">
        Lingkungan ini menggunakan simulasi. Tandara tidak menerbitkan peringatan resmi atau
        menjamin layanan darurat.
      </p>
    </AppShell>
  );
}
