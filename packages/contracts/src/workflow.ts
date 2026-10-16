import { z } from 'zod';

export const workflowStateSchema = z.enum([
  'received',
  'verified',
  'assigned',
  'in_progress',
  'awaiting_approval',
  'resolved',
  'closed',
  'rejected',
  'needs_information',
]);
export const workflowLabels: Record<z.infer<typeof workflowStateSchema>, string> = {
  received: 'Laporan diterima',
  verified: 'Terverifikasi',
  assigned: 'Ditugaskan',
  in_progress: 'Sedang ditangani',
  awaiting_approval: 'Menunggu persetujuan',
  resolved: 'Menunggu konfirmasi warga',
  closed: 'Selesai',
  rejected: 'Ditolak',
  needs_information: 'Perlu informasi warga',
};
export const workflowSchema = z.object({
  status: workflowStateSchema,
  assigneeId: z.uuid().nullable(),
  assigneeName: z.string().nullable(),
  priority: z.enum(['normal', 'high', 'urgent']),
  revision: z.number().int(),
});
export const workflowEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  message: z.string(),
  actor: z.string().nullable(),
  createdAt: z.string(),
});
export const workflowDetailSchema = z.object({
  workflow: workflowSchema,
  events: z.array(workflowEventSchema),
});
export const workflowActionSchema = z.strictObject({
  action: z.enum([
    'verify',
    'request_information',
    'reject',
    'assign',
    'start',
    'update',
    'submit_resolution',
    'approve',
    'return',
  ]),
  revision: z.number().int().positive(),
  message: z.string().trim().min(5).max(2000),
  assigneeId: z.uuid().optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  publishOnMap: z.boolean().optional(),
});
export const citizenFeedbackSchema = z.strictObject({
  action: z.enum(['confirm', 'reopen', 'clarify']),
  revision: z.number().int().positive(),
  message: z.string().trim().min(5).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
});
export const teamMemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(['admin', 'coordinator']),
  activeReports: z.number(),
});
export const reportAnalyticsSchema = z.object({
  total: z.number(),
  byStatus: z.record(z.string(), z.number()),
  byCategory: z.record(z.string(), z.number()),
  urgent: z.number(),
  unassigned: z.number(),
  averageRating: z.number().nullable(),
  feedbackCount: z.number(),
  daily: z.array(z.object({ day: z.string(), count: z.number() })),
});
export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowAction = z.infer<typeof workflowActionSchema>;
