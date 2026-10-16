import { z } from 'zod';
import {
  workflowDetailSchema,
  workflowActionSchema,
  citizenFeedbackSchema,
  teamMemberSchema,
  reportAnalyticsSchema,
  deploymentSchema,
  aiReviewInputSchema,
  assistanceSchema,
  attachmentSchema,
  auditSchema,
  coverageSchema,
  createReportSchema,
  operationsSchema,
  notificationsSchema,
  organizationSchema,
  planContentSchema,
  planSchema,
  planStateSchema,
  publicDataSchema,
  receiptSchema,
  regionConfigSchema,
  regionSchema,
  reportDetailSchema,
  reportPageSchema,
  reviewInputSchema,
  sourceSchema,
  trackingSchema,
  trainingContentSchema,
  trainingSchema,
  userSchema,
  aiRequestSchema,
  aiRunSchema,
  aiReviewSchema,
  aiOperationsSchema,
  knowledgeResultSchema,
  aiEvaluationSchema,
  observationsSchema,
  residentSessionSchema,
  residentReportPageSchema,
  residentReportSchema,
  residentClaimSchema,
  residentClaimResultSchema,
  residentNotificationsSchema,
} from '@tandara/contracts';
const ok = z.object({ ok: z.boolean() });
const id = z.object({ id: z.uuid() });
const reason = z.string().min(5).max(1000);
type Route = [
  string,
  'get' | 'post' | 'put',
  'public' | 'coordinator' | 'admin' | 'receipt' | 'resident' | 'residentReceipt',
  z.ZodType,
  z.ZodType?,
];
export const productRoutes: Route[] = [
  ['/reports/{id}/workflow', 'get', 'coordinator', workflowDetailSchema],
  ['/reports/{id}/workflow', 'post', 'coordinator', ok, workflowActionSchema],
  ['/reports/{id}/feedback', 'post', 'residentReceipt', ok, citizenFeedbackSchema],
  ['/regions/{regionId}/team', 'get', 'coordinator', z.array(teamMemberSchema)],
  ['/regions/{regionId}/report-analytics', 'get', 'coordinator', reportAnalyticsSchema],
  ['/regions/{regionId}/observations', 'get', 'public', observationsSchema],
  ['/resident/auth/me', 'get', 'public', residentSessionSchema],
  ['/resident/reports', 'get', 'resident', residentReportPageSchema],
  ['/resident/reports/{id}', 'get', 'resident', residentReportSchema],
  ['/resident/reports/claim', 'post', 'resident', residentClaimResultSchema, residentClaimSchema],
  ['/resident/reports/{id}/tracking', 'get', 'resident', trackingSchema],
  ['/resident/reports/{id}/feedback', 'post', 'resident', ok, citizenFeedbackSchema],
  ['/resident/reports/{id}/deletion-request', 'post', 'resident', ok],
  ['/resident/notifications', 'get', 'resident', residentNotificationsSchema],
  [
    '/resident/notifications/read',
    'post',
    'resident',
    ok,
    z.strictObject({ id: z.uuid().optional() }),
  ],
  [
    '/resident/auth/login',
    'post',
    'public',
    residentSessionSchema,
    z.strictObject({ phone: z.string(), password: z.string().min(8).max(200) }),
  ],
  [
    '/resident/auth/register',
    'post',
    'public',
    residentSessionSchema,
    z.strictObject({ phone: z.string(), password: z.string().min(8).max(200) }),
  ],
  ['/resident/auth/logout', 'post', 'resident', ok],
  ['/admin/ai/releases/{id}/evaluations', 'post', 'admin', id, aiEvaluationSchema],
  [
    '/regions/{regionId}/knowledge/references',
    'get',
    'coordinator',
    z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        text: z.string(),
        sourceUrl: z.string(),
        licenseNote: z.string(),
        state: z.string(),
        version: z.number(),
        expiresAt: z.string(),
        authorId: z.uuid(),
        reviewerId: z.uuid().nullable(),
      }),
    ),
  ],
  [
    '/regions/{regionId}/knowledge/references',
    'post',
    'coordinator',
    id,
    z.strictObject({
      title: z.string().min(5).max(200),
      text: z.string().min(20).max(12000),
      sourceUrl: z.url(),
      licenseNote: z.string().min(10).max(1000),
      expiresAt: z.iso.datetime({ offset: true }),
    }),
  ],
  [
    '/regions/{regionId}/knowledge/references/{id}/review',
    'post',
    'coordinator',
    ok,
    z.strictObject({
      action: z.enum(['approved', 'withdrawn']),
      note: z.string().min(10).max(1000),
    }),
  ],
  ['/regions/{regionId}/knowledge', 'get', 'public', z.array(knowledgeResultSchema)],
  ['/deployment', 'get', 'public', deploymentSchema],
  ['/regions/{regionId}/ai/runs', 'post', 'coordinator', id, aiRequestSchema],
  ['/regions/{regionId}/ai/runs', 'get', 'coordinator', z.array(aiRunSchema)],
  ['/regions/{regionId}/ai/runs/{id}', 'get', 'coordinator', aiRunSchema],
  ['/regions/{regionId}/ai/runs/{id}/review', 'post', 'coordinator', ok, aiReviewSchema],
  ['/regions/{regionId}/ai/runs/{id}/cancel', 'post', 'coordinator', ok],
  ['/regions/{regionId}/ai/runs/{id}/retry', 'post', 'coordinator', id],
  ['/admin/ai/operations', 'get', 'admin', aiOperationsSchema],
  [
    '/admin/ai/controls',
    'post',
    'admin',
    ok,
    z.strictObject({
      scope: z.enum(['global', 'provider', 'task', 'organization', 'release']),
      scopeId: z.string().min(1).max(200),
      enabled: z.boolean(),
      reason,
    }),
  ],
  [
    '/admin/ai/releases/{id}/approve',
    'post',
    'admin',
    ok,
    z.strictObject({
      evaluationHash: z.string().regex(/^[a-f0-9]{64}$/),
      note: z.string().min(10).max(1000),
    }),
  ],
  ['/admin/ai/releases/{id}/activate', 'post', 'admin', ok],
  [
    '/auth/mfa/enroll',
    'post',
    'coordinator',
    z.object({ secret: z.string(), uri: z.string() }),
    z.strictObject({ password: z.string().min(1).max(200), code: z.string().optional() }),
  ],
  [
    '/auth/mfa/confirm',
    'post',
    'coordinator',
    ok,
    z.strictObject({ code: z.string().regex(/^\d{6}$/) }),
  ],
  [
    '/auth/login',
    'post',
    'public',
    z.object({ user: userSchema, csrf: z.string() }),
    z.strictObject({
      email: z.email(),
      password: z.string().max(200),
      code: z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
    }),
  ],
  ['/auth/me', 'get', 'coordinator', z.object({ user: userSchema, csrf: z.string() })],
  ['/auth/logout', 'post', 'coordinator', ok],
  ['/notifications', 'get', 'coordinator', notificationsSchema],
  [
    '/notifications/preferences',
    'post',
    'coordinator',
    ok,
    z.strictObject({ enabled: z.boolean() }),
  ],
  ['/notifications/{id}/read', 'post', 'coordinator', ok],
  [
    '/regions/{regionId}/triage-summary',
    'get',
    'coordinator',
    z.object({
      provider: z.literal('deterministic'),
      needsHumanReview: z.literal(true),
      generatedAt: z.string(),
      sourceIds: z.array(z.uuid()),
      summary: z.string(),
      groups: z.record(z.string(), z.number()),
    }),
  ],
  ['/regions', 'get', 'public', z.array(regionSchema)],
  ['/regions/{regionId}/public', 'get', 'public', publicDataSchema],
  ['/reports', 'post', 'resident', receiptSchema, createReportSchema],
  ['/reports/{id}/tracking', 'get', 'receipt', trackingSchema],
  ['/reports/{id}/deletion-request', 'post', 'residentReceipt', ok],
  [
    '/reports/{id}/attachments',
    'post',
    'residentReceipt',
    id,
    z.strictObject({ data: z.string().max(2800000) }),
  ],
  ['/regions/{regionId}/reports', 'get', 'coordinator', reportPageSchema],
  ['/reports/{id}', 'get', 'coordinator', reportDetailSchema],
  ['/reports/{id}/reviews', 'post', 'coordinator', ok, reviewInputSchema],
  ['/reports/{id}/triage', 'post', 'coordinator', ok],
  [
    '/reports/{id}/suggestions/{suggestionId}/review',
    'post',
    'coordinator',
    ok,
    aiReviewInputSchema,
  ],
  [
    '/reports/{id}/duplicates/{candidateId}',
    'post',
    'coordinator',
    ok,
    z.strictObject({ state: z.enum(['linked', 'dismissed', 'suggested']), reason }),
  ],
  ['/reports/{id}/attachments/{attachmentId}', 'get', 'coordinator', attachmentSchema],
  ['/regions/{regionId}/plans', 'get', 'coordinator', z.array(planSchema)],
  [
    '/regions/{regionId}/plans',
    'post',
    'coordinator',
    id,
    z.strictObject({ content: planContentSchema, reason }),
  ],
  [
    '/regions/{regionId}/plans/{id}',
    'put',
    'coordinator',
    ok,
    z.strictObject({ content: planContentSchema, reason, updatedAt: z.string() }),
  ],
  [
    '/regions/{regionId}/plans/{id}/transition',
    'post',
    'coordinator',
    ok,
    z.strictObject({ state: planStateSchema, reason }),
  ],
  ['/regions/{regionId}/coverage', 'get', 'coordinator', coverageSchema],
  ['/regions/{regionId}/assistance', 'get', 'coordinator', z.array(assistanceSchema)],
  [
    '/regions/{regionId}/assistance/{id}',
    'post',
    'coordinator',
    ok,
    z.strictObject({
      state: z.enum(['received', 'assigned', 'in_progress', 'closed']),
      note: reason,
      organizationId: z.uuid().nullable(),
    }),
  ],
  ['/regions/{regionId}/training', 'get', 'public', z.array(trainingSchema)],
  ['/regions/{regionId}/training/outcomes', 'get', 'coordinator', z.array(trainingSchema)],
  ['/regions/{regionId}/training', 'post', 'coordinator', id, trainingContentSchema],
  [
    '/regions/{regionId}/training/{id}/results',
    'post',
    'resident',
    z.object({ score: z.number(), total: z.number() }),
    z.strictObject({
      answers: z.array(z.number().int()),
      feedback: z.string().max(500),
      completionKey: z.uuid(),
    }),
  ],
  ['/regions/{regionId}/sources', 'get', 'coordinator', z.array(sourceSchema)],
  [
    '/regions/{regionId}/sources',
    'post',
    'admin',
    id,
    z.strictObject({
      id: z.uuid().optional(),
      name: z.string(),
      provider: z.enum(['fixture', 'bmkg', 'petabencana', 'inarisk']),
      enabled: z.boolean(),
      mode: z.enum(['simulation', 'live', 'disabled']),
      sourceUrl: z.url(),
      licenseNote: z.string(),
      config: z.object({
        authorized: z.boolean(),
        adm4: z.string().optional(),
        admin: z.string().optional(),
        fail: z.boolean().optional(),
      }),
    }),
  ],
  ['/regions/{regionId}/sources/{id}/refresh', 'post', 'coordinator', ok],
  ['/regions/{regionId}/audit', 'get', 'coordinator', z.array(auditSchema)],
  ['/admin/organizations', 'get', 'admin', z.array(organizationSchema)],
  [
    '/admin/organizations',
    'post',
    'admin',
    id,
    z.strictObject({ id: z.uuid().optional(), name: z.string().min(3), description: z.string() }),
  ],
  ['/admin/users', 'get', 'admin', z.array(userSchema)],
  [
    '/admin/users',
    'post',
    'admin',
    id,
    z.strictObject({
      id: z.uuid().optional(),
      email: z.email(),
      name: z.string(),
      password: z.string().min(12).optional(),
      role: z.enum(['admin', 'coordinator']),
      regionIds: z.array(z.uuid()),
      suspended: z.boolean(),
    }),
  ],
  ['/admin/regions', 'get', 'admin', z.array(regionSchema)],
  [
    '/admin/regions',
    'post',
    'admin',
    id,
    z.strictObject({
      id: z.uuid().optional(),
      name: z.string(),
      organizationId: z.uuid(),
      config: regionConfigSchema,
      boundary: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
      }),
      suspended: z.boolean(),
    }),
  ],
  ['/admin/operations', 'get', 'admin', operationsSchema],
  ['/admin/jobs/{id}/retry', 'post', 'admin', ok],
  ['/admin/deletions/{id}/complete', 'post', 'admin', ok],
];
export function buildProductPaths() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [route, method, role, output, input] of productRoutes) {
    const parameters: Array<Record<string, unknown>> = [...route.matchAll(/\{(\w+)\}/g)].map(
      (m) => ({
        name: m[1],
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      }),
    );
    if (method !== 'get')
      parameters.push({
        name: 'X-Tandara-Client',
        in: 'header',
        required: true,
        schema: { const: 'web' },
      });
    if (method !== 'get' && ['coordinator', 'admin', 'resident', 'residentReceipt'].includes(role))
      parameters.push({
        name: 'X-CSRF-Token',
        in: 'header',
        required: true,
        schema: { type: 'string' },
      });
    if (role === 'receipt' || role === 'residentReceipt')
      parameters.push({
        name: 'X-Tracking-Token',
        in: 'header',
        required: true,
        schema: { type: 'string' },
      });
    if (route === '/reports')
      parameters.push({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      });
    if (route === '/resident/reports')
      parameters.push({
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 10000 },
      });
    if (route === '/regions/{regionId}/reports')
      for (const [name, type] of [
        ['page', 'integer'],
        ['q', 'string'],
        ['state', 'string'],
        ['category', 'string'],
        ['sort', 'string'],
      ])
        parameters.push({ name, in: 'query', schema: { type } });
    const binary = route.endsWith('/attachments/{attachmentId}');
    const status = method === 'post' ? '201' : '200';
    const operation = {
      summary: method.toUpperCase() + ' ' + route,
      description:
        'Access: ' +
        role +
        '. All demo workflows are simulation; scoped permissions are enforced server-side.',
      parameters,
      security:
        role === 'resident' || role === 'residentReceipt'
          ? [{ residentSession: [] }]
          : role === 'coordinator' || role === 'admin'
            ? [{ session: [] }]
            : [],
      ...(input
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: z.toJSONSchema(input) } },
            },
          }
        : {}),
      responses: {
        [status]: {
          description: 'Success',
          content: binary
            ? { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } }
            : { 'application/json': { schema: z.toJSONSchema(output) } },
        },
        '400': { description: 'Validation failed' },
        '401': { description: 'Session absent or expired' },
        '403': { description: 'Scope/CSRF/origin rejected' },
        '409': { description: 'Stale revision or invalid transition' },
        '429': { description: 'Rate limit exceeded' },
      },
    };
    const key = '/api/v1' + route;
    paths[key] ??= {};
    paths[key]![method] = operation;
  }
  return paths;
}
