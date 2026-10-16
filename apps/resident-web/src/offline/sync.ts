import { request, ApiError } from '@tandara/api-client';
import { receiptSchema, residentSessionSchema } from '@tandara/contracts';
import { residentCsrf } from '../account/session.js';
import type { CreateReport } from '@tandara/contracts';
import { createUuid } from '@tandara/ui';
import { residentDb } from './database.js';

let running: Promise<void> | null = null;
export async function enqueue(payload: CreateReport, residentId: string) {
  const localId = createUuid();
  await residentDb.drafts.put({
    localId,
    residentId,
    idempotencyKey: localId,
    payload: { ...payload, trackingToken: createUuid() + createUuid() },
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
  if (!drafts.length || !navigator.onLine) return;
  const session = await request('/resident/auth/me', residentSessionSchema);
  if (!session.user) return;
  for (const draft of drafts) {
    if (
      !navigator.onLine ||
      draft.state === 'draft' ||
      draft.state === 'submitted' ||
      draft.retryCount >= 5 ||
      draft.residentId !== session.user.id
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
        headers: {
          'Idempotency-Key': draft.idempotencyKey,
          'X-CSRF-Token': residentCsrf(),
          ...(draft.residentId ? { 'X-Resident-Id': draft.residentId } : {}),
        },
      });
      await residentDb.transaction('rw', residentDb.receipts, residentDb.drafts, async () => {
        await residentDb.receipts.put({
          ...receipt,
          createdAt: new Date().toISOString(),
          description: draft.payload.description,
          category: draft.payload.category,
          landmark: draft.payload.landmarkText,
          followUp: draft.payload.followUpRequested,
        });
        await residentDb.drafts.delete(draft.localId);
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await residentDb.drafts.update(draft.localId, { state: 'queued' });
        window.dispatchEvent(new Event('tandara:queue'));
        return;
      }
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
