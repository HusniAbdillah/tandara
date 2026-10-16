import { Module } from '@nestjs/common';
import { DatabaseModule } from '../platform/database.module.js';
import { IdentityService } from './identity.js';
import { ReportsService } from './reports.js';
import { PreparednessService } from './preparedness.js';
import { AdministrationService } from './administration.js';
import { JobsService } from './jobs.js';
import { AiService } from './ai.js';
import { KnowledgeService } from './knowledge.js';
import { ResidentsService } from './residents.js';
import {
  ObservationsService,
  OBSERVATION_PROVIDER,
  PendingObservationProvider,
} from './observations.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    ResidentsService,
    ObservationsService,
    { provide: OBSERVATION_PROVIDER, useClass: PendingObservationProvider },
    IdentityService,
    ReportsService,
    PreparednessService,
    AdministrationService,
    JobsService,
    AiService,
    KnowledgeService,
  ],
  exports: [
    ResidentsService,
    ObservationsService,
    IdentityService,
    ReportsService,
    PreparednessService,
    AdministrationService,
    JobsService,
    AiService,
    KnowledgeService,
  ],
})
export class ProductModule {}
