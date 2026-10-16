import { describe, expect, it } from 'vitest';
import {
  residentCredentialsSchema,
  residentPhoneSchema,
  residentRegistrationSchema,
} from './resident.js';
import { observationsSchema, waterObservationSchema } from './observations.js';

describe('resident credentials', () => {
  it('requires a personal name only when registering', () => {
    const credentials = { phone: '081234567890', password: 'synthetic-password' };
    expect(residentCredentialsSchema.safeParse(credentials).success).toBe(true);
    expect(residentRegistrationSchema.safeParse(credentials).success).toBe(false);
    expect(residentRegistrationSchema.safeParse({ ...credentials, name: '  ' }).success).toBe(
      false,
    );
    expect(residentRegistrationSchema.parse({ ...credentials, name: ' Rani ' }).name).toBe('Rani');
    expect(
      residentRegistrationSchema.safeParse({ ...credentials, name: 'Rani', role: 'admin' }).success,
    ).toBe(false);
  });
  it('normalizes equivalent Indonesian phone numbers', () => {
    for (const value of ['081234567890', '+62 812-3456-7890', '6281234567890'])
      expect(residentPhoneSchema.parse(value)).toBe('+6281234567890');
  });
  it('rejects malformed phones, short passwords and role injection', () => {
    for (const phone of ['hello', '+15551234567', '081', '+628123456789012345'])
      expect(residentPhoneSchema.safeParse(phone).success).toBe(false);
    expect(
      residentCredentialsSchema.safeParse({ phone: '081234567890', password: 'short' }).success,
    ).toBe(false);
    expect(
      residentCredentialsSchema.safeParse({
        phone: '081234567890',
        password: 'valid-password',
        role: 'admin',
      }).success,
    ).toBe(false);
  });
});
describe('observation provider boundary', () => {
  it('accepts an unconfigured feed without pretending there are current readings', () => {
    expect(
      observationsSchema.parse({
        mode: 'unconfigured',
        fetchedAt: '2026-10-16T00:00:00Z',
        water: [],
        earthquakes: [],
      }).water,
    ).toEqual([]);
  });
  it('rejects invalid location, units and incomplete per-location thresholds', () => {
    const input = {
      id: 'a',
      name: 'Cantiga',
      location: { latitude: -6.2, longitude: 106.8 },
      heightCm: 57,
      status: 'normal',
      updatedAt: '2026-10-15T13:00:00Z',
      thresholds: [
        { status: 'normal', label: '<151 cm' },
        { status: 'waspada', label: '151–175 cm' },
        { status: 'siaga', label: '176–200 cm' },
        { status: 'bahaya', label: '>200 cm' },
      ],
    };
    expect(waterObservationSchema.parse(input).heightCm).toBe(57);
    expect(
      waterObservationSchema.parse({ ...input, heightCm: -167, thresholds: [] }).heightCm,
    ).toBe(-167);
    for (const changes of [
      { heightCm: '57 cm' },
      { location: { latitude: 100, longitude: 106 } },
      { thresholds: input.thresholds.slice(0, 3) },
    ])
      expect(waterObservationSchema.safeParse({ ...input, ...changes }).success).toBe(false);
  });
});
