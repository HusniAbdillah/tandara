import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { CreateReport } from '@tandara/contracts';

export interface SavedPlan {
  versionId: string;
  regionId: string;
  cachedAt: string;
  content: unknown; // Replace with the versioned plan contract in the plan vertical slice.
}

export interface ReportDraft {
  localId: string;
  idempotencyKey: string;
  payload: CreateReport;
  state: 'draft' | 'queued' | 'syncing' | 'submitted' | 'sync_failed';
  retryCount: number;
  updatedAt: string;
}

// Schema foundation only. No reports are persisted or submitted automatically.
export class ResidentDatabase extends Dexie {
  plans!: Table<SavedPlan, string>;
  drafts!: Table<ReportDraft, string>;

  constructor() {
    super('tandara-resident');
    this.version(1).stores({ plans: 'versionId, regionId', drafts: 'localId, state, updatedAt' });
  }
}
