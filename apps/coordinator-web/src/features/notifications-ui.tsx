import { useQuery } from '@tanstack/react-query';
import { request } from '@tandara/api-client';
import { notificationsSchema } from '@tandara/contracts';
import { Badge, Empty, Notice, PageHeader, formatTime } from '@tandara/ui';
import { ok } from './reports-ui.js';
import type { ManagementProps } from './posko-app.js';
export function NotificationsPage({ user, run }: ManagementProps) {
  const data = useQuery({
    queryKey: ['notifications', user.id],
    queryFn: () => request('/notifications', notificationsSchema),
    refetchInterval: 60000,
  });
  return (
    <>
      <PageHeader
        eyebrow="Preferensi"
        title="Pembaruan untuk Anda."
        description="Pembaruan di dalam Posko. Simulasi ini tidak mengirim peringatan darurat atau pesan ke luar platform."
      />
      <section className="panel">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={data.data?.enabled ?? true}
            onChange={(e) =>
              void run(() =>
                request('/notifications/preferences', ok, {
                  method: 'POST',
                  body: { enabled: e.target.checked },
                }),
              ).catch(() => {})
            }
          />
          Terima pembaruan laporan baru
        </label>
      </section>
      {data.isError ? (
        <Notice tone="error">Pembaruan tidak dapat dimuat.</Notice>
      ) : data.data?.items.length ? (
        data.data.items.map((n) => (
          <article className="panel" key={n.id}>
            <Badge tone={n.readAt ? 'neutral' : 'teal'}>{n.readAt ? 'Sudah dibaca' : 'Baru'}</Badge>
            <h2>{n.title}</h2>
            <p className="meta">{formatTime(n.createdAt)}</p>
            {!n.readAt && (
              <button
                onClick={() =>
                  void run(() =>
                    request('/notifications/' + n.id + '/read', ok, { method: 'POST' }),
                  ).catch(() => {})
                }
              >
                Tandai dibaca
              </button>
            )}
          </article>
        ))
      ) : (
        <Empty title="Belum ada pembaruan">
          Laporan baru muncul di sini sesuai wilayah yang ditugaskan.
        </Empty>
      )}
    </>
  );
}
