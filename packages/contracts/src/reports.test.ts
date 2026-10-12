import { describe, expect, it } from 'vitest';
import { createReportSchema } from './reports.js';

const report = {
  regionId: '6baee853-97d2-4f1b-b2d6-2f3477ab7cb3',
  category: 'road_flooding',
  description: 'Air menggenangi jalan dekat balai warga.',
  observationTime: null,
  followUpRequested: false,
  contactPermission: false,
};

describe('resident report input boundary', () => {
  it('accepts unknown observation time without requiring GPS', () => {
    expect(createReportSchema.parse(report).observationTime).toBeNull();
  });

  it('rejects client-controlled moderation and simulation fields', () => {
    expect(createReportSchema.safeParse({ ...report, visibility: 'public' }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...report, isSimulation: false }).success).toBe(false);
  });

  it('rejects invalid coordinates and unexpected nested fields', () => {
    expect(
      createReportSchema.safeParse({ ...report, location: { latitude: 95, longitude: 110 } })
        .success,
    ).toBe(false);
    expect(
      createReportSchema.safeParse({
        ...report,
        location: { latitude: -7, longitude: 110, privateNotes: 'x' },
      }).success,
    ).toBe(false);
  });
});
