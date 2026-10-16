import { z } from 'zod';
import { reportCategorySchema, reportReviewStateSchema } from './reports.js';

export const residentPhoneSchema = z
  .string()
  .trim()
  .transform((value) => {
    const digits = value.replace(/[\s()-]/g, '');
    return digits.startsWith('0')
      ? '+62' + digits.slice(1)
      : digits.startsWith('62')
        ? '+' + digits
        : digits;
  })
  .pipe(z.string().regex(/^\+628\d{7,11}$/, 'Masukkan nomor telepon Indonesia yang valid.'));
export const residentCredentialsSchema = z.strictObject({
  phone: residentPhoneSchema,
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.').max(200),
});
export const residentRegistrationSchema = residentCredentialsSchema.extend({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(100),
});
export const residentProfileSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  name: z.string(),
});
export const residentSessionSchema = z.object({ user: residentProfileSchema.nullable() });
export const residentReportSchema = z.object({
  id: z.uuid(),
  regionId: z.uuid(),
  state: reportReviewStateSchema,
  description: z.string(),
  category: reportCategorySchema,
  landmark: z.string().nullable(),
  followUp: z.boolean(),
  createdAt: z.string(),
});
export const residentReportPageSchema = z.object({
  items: z.array(residentReportSchema).max(50),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export const residentClaimSchema = z.strictObject({
  reports: z
    .array(z.strictObject({ id: z.uuid(), trackingToken: z.string().regex(/^[a-f0-9-]{72}$/) }))
    .min(1)
    .max(100),
});
export const residentClaimResultSchema = z.object({ claimedIds: z.array(z.uuid()).max(100) });
export const residentNotificationSchema = z.object({
  id: z.uuid(),
  reportId: z.uuid(),
  action: z.string().max(100),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  followUp: z.boolean(),
});
export const residentNotificationsSchema = z.object({
  items: z.array(residentNotificationSchema).max(100),
  unreadCount: z.number().int().nonnegative(),
});
export type ResidentProfile = z.infer<typeof residentProfileSchema>;
