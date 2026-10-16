import { useState } from 'react';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import type { Workflow } from '@tandara/contracts';
import { WButton, WError } from './chalk-ui.js';

export function ReportFeedback({
  id,
  token,
  workflow,
  onSaved,
}: {
  id: string;
  token: string;
  workflow: Workflow;
  onSaved: () => Promise<unknown>;
}) {
  const [action, setAction] = useState('confirm'),
    [message, setMessage] = useState(''),
    [rating, setRating] = useState('5'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const clarify = workflow.status === 'needs_information';
  if (!clarify && workflow.status !== 'resolved') return null;
  return (
    <form
      className="w-card w-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await request('/reports/' + id + '/feedback', z.object({ ok: z.boolean() }), {
            method: 'POST',
            headers: { 'X-Tracking-Token': token },
            body: {
              action: clarify ? 'clarify' : action,
              message,
              revision: workflow.revision,
              ...(!clarify && action === 'confirm' ? { rating: Number(rating) } : {}),
            },
          });
          setMessage('');
          await onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Tanggapan belum terkirim. Coba lagi.');
          await onSaved();
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{clarify ? 'Lengkapi informasi laporan' : 'Apakah masalah sudah selesai?'}</h3>
      {!clarify && (
        <label>
          Tanggapan
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="confirm">Ya, masalah sudah selesai</option>
            <option value="reopen">Belum selesai, perlu ditangani lagi</option>
          </select>
        </label>
      )}
      <label>
        {clarify ? 'Informasi tambahan' : 'Catatan untuk Posko'}
        <textarea
          required
          minLength={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      {!clarify && action === 'confirm' && (
        <label>
          Penilaian penanganan
          <select value={rating} onChange={(e) => setRating(e.target.value)}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} dari 5
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <WError>{error}</WError>}
      <WButton disabled={busy} type="submit">
        {busy
          ? 'Mengirim…'
          : clarify
            ? 'Kirim informasi'
            : action === 'confirm'
              ? 'Konfirmasi selesai'
              : 'Minta penanganan kembali'}
      </WButton>
    </form>
  );
}
