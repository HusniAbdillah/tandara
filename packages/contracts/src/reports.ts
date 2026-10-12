import { z } from 'zod';

// API vocabulary only. Database records and privileged response schemas are separate.
export const reportCategorySchema = z.enum([
  'road_flooding',
  'water_entering_homes',
  'blocked_access',
  'debris',
  'damaged_facility',
  'follow_up_needed',
  'other',
]);

export const reportReviewStateSchema = z.enum([
  'submitted',
  'under_review',
  'clarification_requested',
  'reviewed',
  'closed',
]);

export const reportVisibilitySchema = z.enum(['private', 'restricted', 'public']);

// This is a proposed input contract; the report endpoint is not implemented yet.
export const createReportSchema = z.strictObject({
  regionId: z.uuid(),
  category: reportCategorySchema,
  description: z.string().trim().min(10).max(2000),
  observationTime: z.iso.datetime({ offset: true }).nullable(),
  landmarkText: z.string().trim().max(300).optional(),
  location: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().nonnegative().optional(),
  }).optional(),
  followUpRequested: z.boolean(),
  contactPermission: z.boolean(),
});

export type CreateReport = z.infer<typeof createReportSchema>;
export type ReportReviewState = z.infer<typeof reportReviewStateSchema>;
