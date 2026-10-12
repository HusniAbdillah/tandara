import { request, ApiError } from '@tandara/api-client';
import { receiptSchema } from '@tandara/contracts';
import type { CreateReport } from '@tandara/contracts';
import { residentDb } from './database.js';

let running: Promise<void> | null = null;
export async function enqueue(payload: CreateReport) {
  const localId = crypto.randomUUID();
  await residentDb.drafts.put({
    localId,
    idempotencyKey: localId,
    payload: { ...payload, trackingToken: crypto.randomUUID() + crypto.randomUUID() },
    state: 'queued',
    retryCount: 0,
    updatedAt: new Date().toISOString(),
  });
  window.dispatchEvent(new Event('tandara:queue'));
  return localId;
}
async function drain() {
  await residentDb.drafts
    .where('updatedAt')
    .below(new Date(Date.now() - 7 * 86400000).toISOString())
    .delete();
  const drafts = await residentDb.drafts.toArray();
  for (const draft of drafts) {
    if (
      !navigator.onLine ||
      draft.state === 'draft' ||
      draft.state === 'submitted' ||
      draft.retryCount >= 5
    )
      continue;
    await residentDb.drafts.update(draft.localId, {
      state: 'syncing',
      updatedAt: new Date().toISOString(),
    });
    window.dispatchEvent(new Event('tandara:queue'));
    try {
      const receipt = await request('/reports', receiptSchema, {
        method: 'POST',
        body: draft.payload,
        headers: { 'Idempotency-Key': draft.idempotencyKey },
      });
      await residentDb.transaction('rw', residentDb.receipts, residentDb.drafts, async () => {
        await residentDb.receipts.put({ ...receipt, createdAt: new Date().toISOString() });
        await residentDb.drafts.delete(draft.localId);
      });
    } catch (error) {
      await residentDb.drafts.update(draft.localId, {
        state: 'sync_failed',
        retryCount: draft.retryCount + 1,
        error:
          error instanceof ApiError
            ? error.message
            : 'Koneksi terputus. Laporan belum dikonfirmasi server.',
        updatedAt: new Date().toISOString(),
      });
    }
    window.dispatchEvent(new Event('tandara:queue'));
  }
}
export function synchronize(): Promise<void> {
  if (running) return running;
  const job = async () => {
    if ('locks' in navigator) await navigator.locks.request('tandara-report-sync', drain);
    else await drain();
  };
  running = job().finally(() => {
    running = null;
  });
  return running;
}
