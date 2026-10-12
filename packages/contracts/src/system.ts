import { z } from 'zod';

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('tandara-api'),
});

export const systemInfoSchema = z.strictObject({
  name: z.literal('Tandara'),
  mode: z.literal('simulation'),
  stage: z.literal('foundation'),
});

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.array(z.strictObject({ field: z.string(), message: z.string() })).optional(),
  }),
});

export type SystemInfo = z.infer<typeof systemInfoSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
