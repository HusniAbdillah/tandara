import { z } from 'zod';

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const waterObservationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: coordinatesSchema,
  heightCm: z.number().finite().nonnegative(),
  status: z.enum(['normal', 'siaga', 'awas']),
  updatedAt: z.iso.datetime({ offset: true }),
  thresholds: z
    .array(
      z.object({
        status: z.enum(['normal', 'siaga', 'awas']),
        label: z.string().min(1),
      }),
    )
    .length(3),
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
export const observationsSchema = z.object({
  mode: z.enum(['live', 'simulation', 'unconfigured']),
  fetchedAt: z.iso.datetime({ offset: true }),
  water: z.array(waterObservationSchema).max(2000),
  earthquakes: z.array(earthquakeObservationSchema).max(1000),
});
export type WaterObservation = z.infer<typeof waterObservationSchema>;
export type EarthquakeObservation = z.infer<typeof earthquakeObservationSchema>;
export type Observations = z.infer<typeof observationsSchema>;
