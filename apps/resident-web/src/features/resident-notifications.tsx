import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { formatTime } from '@tandara/ui';
import type { ResidentData } from './resident-data.js';
import { residentCsrf } from '../account/session.js';
import { WButton, WEmpty, WError, WRow } from './chalk-ui.js';

const titles: Record<string, string> = {
  under_review: 'Posko sedang meninjau laporanmu',
  clarification_requested: 'Posko meminta informasi tambahan',
  reviewed: 'Laporanmu telah ditinjau',
  rejected: 'Laporanmu tidak diteruskan',
  closed: 'Laporanmu ditutup',
  'assistance.received': 'Permintaan bantuan diterima',
  'assistance.assigned': 'Permintaan bantuan telah ditugaskan',
  'assistance.in_progress': 'Permintaan bantuan sedang ditangani',
  'assistance.closed': 'Permintaan bantuan ditutup',
  'workflow.received': 'Informasi laporanmu telah diterima',
  'workflow.verified': 'Laporanmu telah diverifikasi',
  'workflow.needs_information': 'Posko meminta informasi tambahan',
  'workflow.assigned': 'Laporanmu telah ditugaskan',
  'workflow.in_progress': 'Laporanmu sedang ditangani',
  'workflow.awaiting_approval': 'Penanganan menunggu persetujuan',
  'workflow.resolved': 'Penanganan selesai, periksa hasilnya',
  'workflow.closed': 'Laporanmu ditutup',
  'workflow.rejected': 'Laporanmu tidak diteruskan',
};
export function PersonalNotifications({ app }: { app: ResidentData }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function read(id?: string) {
    await request('/resident/notifications/read', z.object({ ok: z.boolean() }), {
      method: 'POST',
      body: id ? { id } : {},
      headers: { 'X-CSRF-Token': residentCsrf() },
    });
    await app.notifications.refetch();
  }
  return (
    <section className="w-personal-notifications w-stack" aria-label="Notifikasi laporan">
      <div className="w-page-heading">
        <h2>Laporanmu</h2>
        {!!app.notifications.data?.unreadCount && (
          <WButton
            quiet
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await read();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Belum dapat diperbarui.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Tandai semua dibaca
          </WButton>
        )}
      </div>
      {app.notifications.isPending && <p role="status">Memuat notifikasi…</p>}
      {(error || app.notifications.isError) && (
        <WError>{error || 'Notifikasi belum dapat dimuat.'}</WError>
      )}
      {app.notifications.data?.items.map((item) => (
        <div key={item.id} className={item.readAt ? 'w-notification' : 'w-notification is-unread'}>
          <WRow
            title={titles[item.action] ?? 'Status laporanmu diperbarui'}
            subtitle={
              (item.followUp ? 'Permintaan bantuan' : 'Laporan') +
              ' · ' +
              formatTime(item.createdAt)
            }
            onClick={async () => {
              setError('');
              try {
                if (!item.readAt) await read(item.id);
                navigate('/tracking?id=' + item.reportId);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Notifikasi belum dapat dibuka.');
              }
            }}
          />
        </div>
      ))}
      {app.notifications.data && !app.notifications.data.items.length && (
        <WEmpty title="Belum ada pembaruan laporan" />
      )}
    </section>
  );
}
