import { z } from 'zod';

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const waterStatusSchema = z.enum(['normal', 'waspada', 'siaga', 'bahaya']);
export const waterObservationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: coordinatesSchema,
  heightCm: z.number().finite(),
  status: waterStatusSchema,
  updatedAt: z.iso.datetime({ offset: true }),
  thresholds: z
    .array(
      z.object({
        status: waterStatusSchema,
        label: z.string().min(1),
      }),
    )
    .max(4)
    .refine(
      (ranges) => ranges.length === 0 || ranges.length === 4,
      'Expected all four levels or no ranges',
    ),
  rawThresholdsCm: z
    .object({
      siaga1: z.number().finite(),
      siaga2: z.number().finite(),
      siaga3: z.number().finite(),
    })
    .optional(),
});
export const earthquakeObservationSchema = z.object({
  id: z.string().min(1),
  location: coordinatesSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  magnitude: z.number().finite().nonnegative(),
  depthKm: z.number().finite().nonnegative(),
  region: z.string().min(1),
  felt: z.string(),
});
export const observationSourceSchema = z.object({
  id: z.enum(['dsda', 'bmkg']),
  name: z.string().min(1),
  url: z.url(),
  status: z.enum(['ready', 'stale', 'unavailable']),
  checkedAt: z.iso.datetime({ offset: true }),
  lastSuccessAt: z.iso.datetime({ offset: true }).nullable(),
  skippedRecords: z.number().int().nonnegative(),
});
export const observationsSchema = z.object({
  mode: z.enum(['live', 'simulation', 'unconfigured']),
  fetchedAt: z.iso.datetime({ offset: true }),
  water: z.array(waterObservationSchema).max(2000),
  earthquakes: z.array(earthquakeObservationSchema).max(1000),
  sources: z.array(observationSourceSchema).max(2).default([]),
});
export type ObservationSource = z.infer<typeof observationSourceSchema>;
export type WaterObservation = z.infer<typeof waterObservationSchema>;
export type EarthquakeObservation = z.infer<typeof earthquakeObservationSchema>;
export type Observations = z.infer<typeof observationsSchema>;
