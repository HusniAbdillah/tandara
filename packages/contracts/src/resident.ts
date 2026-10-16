import { z } from 'zod';

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
export type ResidentProfile = z.infer<typeof residentProfileSchema>;
