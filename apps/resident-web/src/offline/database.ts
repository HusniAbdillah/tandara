import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { CreateReport } from '@tandara/contracts';
import type { Plan } from '@tandara/contracts';

export interface SavedPlan {
  versionId: string;
  regionId: string;
  cachedAt: string;
  content: Plan;
}

export interface ReportDraft {
  localId: string;
  idempotencyKey: string;
  payload: CreateReport;
  state: 'draft' | 'queued' | 'syncing' | 'submitted' | 'sync_failed';
  retryCount: number;
  updatedAt: string;
  error?: string;
}

export interface Receipt {
  id: string;
  trackingToken: string;
  createdAt: string;
  state: string;
}

// Only consented text drafts and receipt secrets are persisted; private contacts and GPS stay online.
export class ResidentDatabase extends Dexie {
  plans!: Table<SavedPlan, string>;
  drafts!: Table<ReportDraft, string>;
  receipts!: Table<Receipt, string>;

  constructor() {
    super('tandara-resident');
    this.version(1).stores({ plans: 'versionId, regionId', drafts: 'localId, state, updatedAt' });
    this.version(2).stores({
      plans: 'versionId, regionId',
      drafts: 'localId, state, updatedAt',
      receipts: 'id,createdAt',
    });
  }
}
export const residentDb = new ResidentDatabase();
