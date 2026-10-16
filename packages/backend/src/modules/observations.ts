import { Inject, Injectable } from '@nestjs/common';
import { observationsSchema } from '@tandara/contracts';
import type { Observations, Region } from '@tandara/contracts';
import { IdentityService } from './identity.js';

/** Upstream payloads stay on the server; the map consumes this normalized contract. */
export interface ObservationProvider {
  read(region: Region): Promise<Observations>;
}
export const OBSERVATION_PROVIDER = Symbol('OBSERVATION_PROVIDER');
export class SimulationObservationProvider implements ObservationProvider {
  async read(region: Region): Promise<Observations> {
    const base = { fetchedAt: new Date().toISOString(), water: [], earthquakes: [], sources: [] };
    if (!region.simulation) return { ...base, mode: 'unconfigured' };
    return observationsSchema.parse({
      ...base,
      mode: 'simulation',
      water: [
        {
          id: 'cantiga',
          name: 'Cantiga–Karang Tengah',
          location: { latitude: -6.226, longitude: 106.869 },
          heightCm: 57,
          status: 'normal',
          updatedAt: '2026-10-15T13:00:00Z',
          thresholds: [
            { status: 'normal', label: '≤ 150 cm' },
            { status: 'waspada', label: '>150 sampai 175 cm' },
            { status: 'siaga', label: '>175 sampai 200 cm' },
            { status: 'bahaya', label: '> 200 cm' },
          ],
        },
        {
          id: 'rw06-gate',
          name: 'Pintu Air RW 06',
          location: { latitude: -6.232, longitude: 106.872 },
          heightCm: 270,
          status: 'bahaya',
          updatedAt: '2026-10-15T12:55:00Z',
          thresholds: [
            { status: 'normal', label: '≤ 200 cm' },
            { status: 'waspada', label: '>200 sampai 225 cm' },
            { status: 'siaga', label: '>225 sampai 250 cm' },
            { status: 'bahaya', label: '> 250 cm' },
          ],
        },
        {
          id: 'rw06-area',
          name: 'Kawasan RW 06',
          location: { latitude: -6.229, longitude: 106.863 },
          heightCm: 24,
          status: 'siaga',
          updatedAt: '2026-10-15T12:50:00Z',
          thresholds: [
            { status: 'normal', label: '≤ 15 cm' },
            { status: 'waspada', label: '>15 sampai 20 cm' },
            { status: 'siaga', label: '>20 sampai 30 cm' },
            { status: 'bahaya', label: '> 30 cm' },
          ],
        },
      ],
      earthquakes: [
        {
          id: 'bogor-20261015',
          location: { latitude: -6.73, longitude: 106.61 },
          occurredAt: '2026-10-15T10:58:23Z',
          magnitude: 4.1,
          depthKm: 5,
          region: 'Pusat gempa berada di darat 26 km barat daya kota Bogor',
          felt: 'IV Pamijahan, IV Kabandungan',
        },
      ],
    });
  }
}
export class DisabledObservationProvider implements ObservationProvider {
  async read(): Promise<Observations> {
    return {
      mode: 'unconfigured',
      fetchedAt: new Date().toISOString(),
      water: [],
      earthquakes: [],
      sources: [],
    };
  }
}
@Injectable()
export class ObservationsService {
  constructor(
    @Inject(IdentityService) readonly identity: IdentityService,
    @Inject(OBSERVATION_PROVIDER) readonly provider: ObservationProvider,
  ) {}
  async read(regionId: string) {
    const region = (await this.identity.regions()).find((r) => r.id === regionId);
    if (!region)
      return observationsSchema.parse({
        mode: 'unconfigured',
        fetchedAt: new Date().toISOString(),
        water: [],
        earthquakes: [],
      });
    return observationsSchema.parse(await this.provider.read(region));
  }
}
