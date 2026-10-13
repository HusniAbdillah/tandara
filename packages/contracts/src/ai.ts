import { z } from 'zod';
export const deploymentSchema = z.object({
  mode: z.enum(['simulation', 'production']),
  residentOrigin: z.url(),
  coordinatorOrigin: z.url(),
});

export const aiTaskSchema = z.enum([
  'triage',
  'duplicates',
  'briefing',
  'answer',
  'clarification',
  'public_summary',
  'plan_draft',
  'training_draft',
  'translation',
  'coverage',
]);
export const aiRequestSchema = z
  .strictObject({
    task: aiTaskSchema.exclude(['triage']),
    requestKey: z.uuid(),
    reportId: z.uuid().optional(),
    question: z.string().trim().min(3).max(1500).optional(),
    hours: z.number().int().min(1).max(168).default(24),
    language: z.enum(['id', 'jv', 'su']).default('id'),
  })
  .superRefine((value, ctx) => {
    if (['duplicates', 'clarification', 'public_summary'].includes(value.task) && !value.reportId)
      ctx.addIssue({ code: 'custom', path: ['reportId'], message: 'Laporan diperlukan.' });
    if (
      ['answer', 'translation', 'plan_draft', 'training_draft'].includes(value.task) &&
      !value.question
    )
      ctx.addIssue({
        code: 'custom',
        path: ['question'],
        message: 'Pertanyaan atau teks diperlukan.',
      });
  });
export const aiEvidenceSchema = z.strictObject({
  id: z.string().min(1).max(200),
  entityId: z.uuid(),
  kind: z.enum(['plan', 'reference', 'report', 'counts', 'coverage', 'instruction']),
  version: z.string().max(100),
  title: z.string().max(300),
  text: z.string().max(8000),
});
export const aiClaimSchema = z.strictObject({
  text: z.string().min(1).max(1500),
  state: z.enum(['explicit', 'ambiguous', 'contradicted', 'insufficient_evidence']),
  citations: z
    .array(z.strictObject({ sourceId: z.string().max(200), quote: z.string().min(1).max(1500) }))
    .max(10),
});
export const aiAssistanceOutputSchema = z.strictObject({
  title: z.string().min(1).max(200),
  claims: z.array(aiClaimSchema).max(30),
  questions: z.array(z.string().min(1).max(500)).max(10),
  abstained: z.boolean(),
  limitation: z.string().min(1).max(1000),
  translation: z.string().max(6000).nullable(),
  draft: z
    .strictObject({
      kind: z.enum(['clarification', 'public_summary', 'plan_draft', 'training_draft']),
      sections: z
        .array(
          z.strictObject({
            heading: z.string().min(1).max(150),
            text: z.string().min(1).max(2000),
            citations: z
              .array(
                z.strictObject({
                  sourceId: z.string().max(200),
                  quote: z.string().min(1).max(1500),
                }),
              )
              .min(1)
              .max(10),
          }),
        )
        .min(1)
        .max(30),
    })
    .nullable()
    .default(null),
  needsHumanReview: z.literal(true),
});
export const aiReviewSchema = z.strictObject({
  action: z.enum(['accepted', 'edited', 'rejected']),
  note: z.string().trim().min(5).max(1000),
  output: aiAssistanceOutputSchema.optional(),
});
export const aiRunSchema = z.object({
  id: z.uuid(),
  regionId: z.uuid(),
  task: aiTaskSchema,
  state: z.enum(['queued', 'processing', 'ready', 'failed', 'cancelled', 'expired', 'unavailable']),
  createdAt: z.string(),
  error: z.string().nullable(),
  releaseId: z.uuid(),
  output: aiAssistanceOutputSchema.nullable(),
  sources: z.array(aiEvidenceSchema),
  reviews: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      note: z.string(),
      reviewerId: z.uuid(),
      createdAt: z.string(),
      output: aiAssistanceOutputSchema.nullable(),
    }),
  ),
  provenance: z.record(z.string(), z.unknown()),
});
export const knowledgeResultSchema = z.object({
  sourceUrl: z.url().nullable().default(null),
  kind: z.enum(['plan', 'reference']).default('plan'),
  id: z.string(),
  entityId: z.uuid(),
  title: z.string(),
  section: z.string(),
  version: z.string(),
  text: z.string(),
  expiresAt: z.string(),
  simulation: z.boolean(),
});
export const aiOperationsSchema = z.object({
  embeddingMode: z.enum(['disabled', 'compatible']),
  mode: z.string(),
  provider: z.string(),
  model: z.string(),
  controls: z.array(
    z.object({ scope: z.string(), scopeId: z.string(), enabled: z.boolean(), reason: z.string() }),
  ),
  runs: z.array(z.object({ task: z.string(), state: z.string(), count: z.number() })),
  budgets: z.array(
    z.object({
      organizationId: z.uuid(),
      day: z.string(),
      reserved: z.number(),
      limit: z.number(),
    }),
  ),
  releases: z.array(
    z.object({
      id: z.uuid(),
      manifest: z.record(z.string(), z.unknown()),
      createdAt: z.string(),
      approved: z.boolean(),
    }),
  ),
  attempts: z.array(
    z.object({
      provider: z.string(),
      state: z.string(),
      count: z.number(),
      estimatedTokens: z.number(),
    }),
  ),
});
export type AiTask = z.infer<typeof aiTaskSchema>;
export type AiEvidence = z.infer<typeof aiEvidenceSchema>;
export type AiAssistanceOutput = z.infer<typeof aiAssistanceOutputSchema>;
export type AiRun = z.infer<typeof aiRunSchema>;
export const aiEvaluationSchema = z
  .strictObject({
    artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
    modelFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
    caseCount: z.number().int().min(1000),
    adversarialCount: z.number().int().min(200),
    reviewedCaseCount: z.number().int().min(1000),
    candidateModels: z.array(z.string().min(1).max(200)).min(2).max(10),
    validOutputRate: z.number().min(0.99).max(1),
    macroF1: z.number().min(0.9).max(1),
    followUpRecall: z.number().min(0.95).max(1),
    supportedClaimRate: z.number().min(0.99).max(1),
    retrievalRecallAt10: z.number().min(0.95).max(1),
    correctAbstentionRate: z.number().min(0.95).max(1),
    unsupportedCriticalClaims: z.literal(0),
    crossRegionLeaks: z.literal(0),
    unauthorizedMutations: z.literal(0),
    independentSecurityReviewHash: z.string().regex(/^[a-f0-9]{64}$/),
    qualifiedTranslationReviewHash: z.string().regex(/^[a-f0-9]{64}$/),
    reviewedBy: z.array(z.string().min(3).max(200)).min(2).max(20),
    completedAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((v, ctx) => {
    if (
      v.reviewedCaseCount < v.caseCount ||
      v.adversarialCount > v.caseCount ||
      new Set(v.candidateModels).size < 2 ||
      new Set(v.reviewedBy).size < 2
    )
      ctx.addIssue({ code: 'custom', message: 'Independent complete release evaluation required' });
  });
