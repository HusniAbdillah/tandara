import { z } from 'zod';
import { reportCategorySchema, reportReviewStateSchema } from './reports.js';
import { workflowSchema, workflowEventSchema } from './workflow.js';

export const regionConfigSchema = z.strictObject({
  categories: z.array(reportCategorySchema).min(1),
  coverageHours: z.number().int().min(1).max(168),
  retentionDays: z.number().int().min(7).max(365),
  contacts: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(100),
        channel: z.string().max(200),
        sourceUrl: z.url(),
        reviewedAt: z.iso.datetime({ offset: true }),
      }),
    )
    .max(20),
  languages: z
    .array(z.enum(['id', 'jv', 'su']))
    .min(1)
    .max(3),
});
export const pointSchema = z.strictObject({
  name: z.string().min(3).max(100),
  description: z.string().min(5).max(1000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accessibility: z.string().max(300),
});
export const planContentSchema = z.strictObject({
  title: z.string().trim().min(5).max(150),
  instructions: z.array(z.string().trim().min(5).max(1000)).min(1).max(30),
  points: z.array(pointSchema).max(20),
  routes: z
    .array(
      z.strictObject({
        name: z.string().max(100),
        description: z.string().max(1000),
        reviewNote: z.string().min(5).max(500),
      }),
    )
    .max(20),
  checklist: z.array(z.string().min(3).max(200)).min(1).max(30),
  expiresAt: z.iso.datetime({ offset: true }),
});
export const planStateSchema = z.enum([
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'archived',
]);
export const planSchema = z.object({
  id: z.uuid(),
  regionId: z.uuid(),
  version: z.number(),
  state: planStateSchema,
  content: planContentSchema,
  owner: z.string(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewer: z.string().nullable(),
  authorId: z.uuid(),
  updatedAt: z.string(),
  simulation: z.boolean(),
});
export const regionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organizationId: z.uuid(),
  organization: z.string(),
  config: regionConfigSchema,
  boundary: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number()))),
  }),
  simulation: z.boolean(),
  suspended: z.boolean(),
});
export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(['coordinator', 'admin']),
  regionIds: z.array(z.uuid()),
  suspended: z.boolean(),
});
export const historySchema = z.object({
  id: z.uuid(),
  action: z.string(),
  reason: z.string(),
  actor: z.string().nullable(),
  createdAt: z.string(),
});
export const triageSchema = z.strictObject({
  suggestedCategory: reportCategorySchema.nullable(),
  facts: z
    .array(
      z.strictObject({
        field: z.enum(['description', 'landmark', 'observed_at']),
        value: z.string().max(2000),
        evidence: z.string().min(1).max(2000),
      }),
    )
    .max(20),
  missingInformation: z.array(z.string().max(300)).max(20),
  summary: z.string().max(2000),
  sourceIds: z.array(z.uuid()).max(100),
  needsHumanReview: z.literal(true),
});
export const suggestionSchema = z.object({
  reviewedOutput: triageSchema.nullable().optional(),
  legacyProvenance: z.boolean().optional(),
  reviews: z
    .array(
      z.object({
        id: z.uuid(),
        action: z.string(),
        note: z.string(),
        output: triageSchema.nullable(),
        reviewerId: z.uuid(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  id: z.uuid(),
  output: triageSchema.nullable(),
  state: z.enum(['ready', 'failed', 'accepted', 'edited', 'rejected']),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  durationMs: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  humanNote: z.string().nullable(),
});
export const reportSchema = z.object({
  workflow: workflowSchema.optional(),
  id: z.uuid(),
  regionId: z.uuid(),
  category: reportCategorySchema,
  description: z.string(),
  landmarkText: z.string().nullable(),
  observationTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: reportReviewStateSchema,
  followUpRequested: z.boolean(),
  contactDetails: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  publicSummary: z.string().nullable(),
  simulation: z.boolean(),
  revision: z.number(),
});
export const duplicateSchema = z.object({
  id: z.uuid(),
  reportId: z.uuid(),
  otherId: z.uuid(),
  evidence: z.string(),
  state: z.enum(['suggested', 'linked', 'dismissed']),
  otherDescription: z.string(),
});
export const attachmentSchema = z.object({ id: z.uuid(), name: z.string(), createdAt: z.string() });
export const reportDetailSchema = z.object({
  report: reportSchema,
  reporterPhone: z.string().nullable(),
  history: z.array(historySchema),
  suggestions: z.array(suggestionSchema),
  duplicates: z.array(duplicateSchema),
  attachments: z.array(attachmentSchema),
});
export const reportPageSchema = z.object({
  items: z.array(reportSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export const receiptSchema = z.object({
  id: z.uuid(),
  trackingToken: z.string(),
  state: reportReviewStateSchema,
  residentId: z.uuid().optional(),
});
export const trackingSchema = z.object({
  attachments: z.array(attachmentSchema).default([]),
  workflow: workflowSchema.optional(),
  updates: z.array(workflowEventSchema).optional(),
  id: z.uuid(),
  state: reportReviewStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  history: z.array(historySchema),
  assistanceState: z.string().nullable(),
  erased: z.boolean(),
});
export const reviewInputSchema = z.strictObject({
  state: reportReviewStateSchema,
  reason: z.string().trim().min(5).max(1000),
  category: reportCategorySchema.optional(),
  publicSummary: z.string().trim().min(10).max(1000).optional(),
  revision: z.number().int().min(1),
});
export const aiReviewInputSchema = z.strictObject({
  action: z.enum(['accepted', 'edited', 'rejected']),
  note: z.string().trim().min(5).max(1000),
  output: triageSchema.optional(),
});
export const sourceProviderSchema = z.enum([
  'fixture',
  'bmkg',
  'bmkg_nowcast',
  'petabencana',
  'inarisk',
]);
export const sourceSchema = z.object({
  id: z.uuid(),
  regionId: z.uuid(),
  name: z.string(),
  provider: sourceProviderSchema,
  enabled: z.boolean(),
  mode: z.enum(['simulation', 'live', 'disabled']),
  sourceUrl: z.string(),
  licenseNote: z.string(),
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
  config: z.record(z.string(), z.unknown()),
});
export const informationSchema = z.object({
  id: z.uuid(),
  sourceId: z.uuid(),
  regionId: z.uuid(),
  title: z.string(),
  body: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  sourceType: z.enum(['official_weather', 'official_alert', 'external_community', 'simulation']),
  issuedAt: z.string().nullable().default(null),
  observedAt: z.string().nullable(),
  fetchedAt: z.string(),
  effectiveAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  verificationStatus: z.string(),
  version: z.string(),
  simulation: z.boolean(),
});
export const publicReportSchema = z.object({
  id: z.uuid(),
  category: reportCategorySchema,
  summary: z.string(),
  landmarkText: z.string().nullable(),
  observationTime: z.string().nullable(),
  reviewedAt: z.string(),
  reviewer: z.string(),
  simulation: z.boolean(),
  location: z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
});
export const publicSourceHealthSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  provider: sourceProviderSchema,
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  failed: z.boolean(),
});
export const publicDataSchema = z.object({
  region: regionSchema,
  plans: z.array(planSchema),
  information: z.array(informationSchema),
  reports: z.array(publicReportSchema),
  sources: z.array(publicSourceHealthSchema).default([]),
  fetchedAt: z.string(),
});
export const coverageSchema = z.object({
  hours: z.number(),
  method: z.string(),
  generatedAt: z.string(),
  cells: z.array(
    z.object({
      id: z.number(),
      geometry: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
      }),
      count: z.number(),
      state: z.enum(['information_available', 'insufficient_information']),
    }),
  ),
});
export const assistanceSchema = z.object({
  id: z.uuid(),
  reportId: z.uuid(),
  regionId: z.uuid(),
  state: z.enum(['received', 'assigned', 'in_progress', 'closed']),
  note: z.string(),
  organizationId: z.uuid().nullable(),
  updatedAt: z.string(),
  description: z.string(),
  contactDetails: z.string().nullable(),
});
export const trainingContentSchema = z
  .strictObject({
    title: z.string().min(5).max(150),
    description: z.string().min(10).max(2000),
    steps: z
      .array(
        z.strictObject({
          question: z.string().min(5).max(500),
          options: z.array(z.string().min(1).max(300)).min(2).max(5),
          answer: z.number().int().min(0).max(4),
          explanation: z.string().min(5).max(1000),
        }),
      )
      .min(1)
      .max(20),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((v) => v.steps.every((s) => s.answer < s.options.length), 'Jawaban di luar pilihan');
export const trainingSchema = z.object({
  id: z.uuid(),
  regionId: z.uuid(),
  content: trainingContentSchema,
  simulation: z.literal(true),
  participants: z.number(),
  completed: z.number(),
  feedback: z.array(z.string()),
});
export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
});
export const auditSchema = z.object({
  id: z.uuid(),
  actor: z.string().nullable(),
  regionId: z.uuid().nullable(),
  action: z.string(),
  entityId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export const jobSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  state: z.string(),
  attempts: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export const deletionSchema = z.object({
  id: z.uuid(),
  reportId: z.uuid(),
  regionId: z.uuid(),
  state: z.enum(['requested', 'completed']),
  createdAt: z.string(),
});
export const operationsSchema = z.object({
  database: z.boolean(),
  workerLastSeen: z.string().nullable(),
  aiMode: z.string(),
  jobs: z.array(jobSchema),
  deletions: z.array(deletionSchema),
});

export type Region = z.infer<typeof regionSchema>;
export type User = z.infer<typeof userSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanContent = z.infer<typeof planContentSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ReportDetail = z.infer<typeof reportDetailSchema>;
export type Triage = z.infer<typeof triageSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Information = z.infer<typeof informationSchema>;
export type Training = z.infer<typeof trainingSchema>;
export type PublicData = z.infer<typeof publicDataSchema>;
export type Coverage = z.infer<typeof coverageSchema>;
export const notificationsSchema = z.object({
  enabled: z.boolean(),
  items: z.array(
    z.object({
      id: z.uuid(),
      regionId: z.uuid().nullable(),
      title: z.string(),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
});
