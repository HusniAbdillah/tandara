import { Logger } from '@nestjs/common';
import type {
  Observations,
  ObservationSource,
  WaterObservation,
  EarthquakeObservation,
} from '@tandara/contracts';
import type { ObservationProvider } from './observations.js';
import {
  WATER_SOURCE_URL,
  EARTHQUAKE_SOURCE_URL,
  fetchObservationText,
  parseWaterObservations,
  parseEarthquakeObservations,
} from './observation-sources.js';
import type { ParsedObservations } from './observation-sources.js';

const REFRESH_MS = 60000;
const MAX_STALE_MS = 24 * 3600000;
class SourceCache<T> {
  private records: T[] = [];
  private checkedAt = 0;
  private lastSuccessAt: number | null = null;
  private skippedRecords = 0;
  private failed = false;
  private pending: Promise<void> | undefined;
  private readonly logger = new Logger('MapObservations');
  constructor(
    private readonly source: Pick<ObservationSource, 'id' | 'name' | 'url'>,
    private readonly load: () => Promise<ParsedObservations<T>>,
  ) {}
  async read(): Promise<{ records: T[]; source: ObservationSource }> {
    if (!this.checkedAt || Date.now() - this.checkedAt >= REFRESH_MS) {
      this.pending ??= this.refresh().finally(() => {
        this.pending = undefined;
      });
      await this.pending;
    } else if (this.pending) await this.pending;
    const expired = this.lastSuccessAt === null || Date.now() - this.lastSuccessAt > MAX_STALE_MS;
    return {
      records: expired ? [] : this.records,
      source: {
        ...this.source,
        status: expired ? 'unavailable' : this.failed ? 'stale' : 'ready',
        checkedAt: new Date(this.checkedAt).toISOString(),
        lastSuccessAt:
          this.lastSuccessAt === null ? null : new Date(this.lastSuccessAt).toISOString(),
        skippedRecords: this.skippedRecords,
      },
    };
  }
  private async refresh() {
    try {
      const result = await this.load();
      this.records = result.records;
      this.skippedRecords = result.skippedRecords;
      this.lastSuccessAt = Date.now();
      this.failed = false;
    } catch {
      this.failed = true;
      // No upstream HTML, headers, or arbitrary error strings in application logs.
      this.logger.warn(
        `Public map source ${this.source.id} unavailable; retaining last successful snapshot`,
      );
    } finally {
      this.checkedAt = Date.now();
    }
  }
}

/** One cache per upstream, shared by every region and request in this API process. */
export class LiveObservationProvider implements ObservationProvider {
  private readonly water: SourceCache<WaterObservation>;
  private readonly earthquakes: SourceCache<EarthquakeObservation>;
  constructor(fetcher: typeof fetch = fetch) {
    this.water = new SourceCache(
      { id: 'dsda', name: 'Dinas SDA DKI Jakarta', url: WATER_SOURCE_URL },
      async () => parseWaterObservations(await fetchObservationText(WATER_SOURCE_URL, fetcher)),
    );
    this.earthquakes = new SourceCache(
      { id: 'bmkg', name: 'BMKG', url: EARTHQUAKE_SOURCE_URL },
      async () =>
        parseEarthquakeObservations(await fetchObservationText(EARTHQUAKE_SOURCE_URL, fetcher)),
    );
  }
  async read(): Promise<Observations> {
    const [water, quakes] = await Promise.all([this.water.read(), this.earthquakes.read()]);
    return {
      mode: 'live',
      fetchedAt: new Date().toISOString(),
      water: water.records,
      earthquakes: quakes.records,
      sources: [water.source, quakes.source],
    };
  }
}
