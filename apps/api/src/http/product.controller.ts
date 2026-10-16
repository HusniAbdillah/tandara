import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  workflowDetail,
  updateWorkflow,
  citizenFeedback,
  reportTeam,
  reportAnalytics,
  AdministrationService,
  IdentityService,
  PreparednessService,
  ReportsService,
  AiService,
  KnowledgeService,
  ResidentsService,
  ObservationsService,
} from '@tandara/backend';

@Controller('api/v1')
export class ProductController {
  constructor(
    @Inject(IdentityService) readonly identity: IdentityService,
    @Inject(ReportsService) readonly reports: ReportsService,
    @Inject(PreparednessService) readonly plans: PreparednessService,
    @Inject(AdministrationService) readonly admin: AdministrationService,
    @Inject(AiService) readonly ai: AiService,
    @Inject(KnowledgeService) readonly knowledge: KnowledgeService,
    @Inject(ResidentsService) readonly residents: ResidentsService,
    @Inject(ObservationsService) readonly observations: ObservationsService,
  ) {}
  @Get('regions/:regionId/observations') observationFeed(@Param('regionId') region: string) {
    return this.observations.read(region);
  }
  @Get('resident/auth/me') async residentMe(@Req() req: FastifyRequest) {
    return { user: await this.residents.session(req.cookies['tandara_resident']) };
  }
  resident(req: FastifyRequest) {
    return this.residents.authenticate(
      req.cookies['tandara_resident'],
      ['GET', 'HEAD'].includes(req.method) ? undefined : String(req.headers['x-csrf-token'] ?? ''),
    );
  }
  @Get('resident/reports') async residentReports(
    @Req() req: FastifyRequest,
    @Query('page') page: string | undefined,
  ) {
    return this.residents.reports(await this.resident(req), page);
  }
  @Post('resident/reports/claim') async claimReports(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.residents.claim(await this.resident(req), body);
  }
  @Get('resident/reports/:id/tracking') async residentTrack(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.reports.track(id, undefined, (await this.resident(req)).id);
  }
  @Get('resident/reports/:id') async residentReport(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.residents.report(await this.resident(req), id);
  }
  @Post('resident/reports/:id/feedback') async residentFeedback(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return citizenFeedback(this.reports, id, undefined, body, (await this.resident(req)).id);
  }
  @Post('resident/reports/:id/deletion-request') async residentErase(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.reports.eraseRequest(id, undefined, (await this.resident(req)).id);
  }
  @Get('resident/notifications') async residentNotifications(@Req() req: FastifyRequest) {
    return this.residents.notifications(await this.resident(req));
  }
  @Post('resident/notifications/read') async readResidentNotifications(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.residents.readNotifications(await this.resident(req), body);
  }
  @Post('resident/auth/:action') async residentAuth(
    @Param('action') action: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const options = {
      httpOnly: true,
      secure: process.env['SESSION_SECURE'] === 'true',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 28800,
    };
    if (action === 'logout') {
      await this.residents.logout(
        req.cookies['tandara_resident'],
        String(req.headers['x-csrf-token'] ?? ''),
      );
      reply.clearCookie('tandara_resident', { path: '/' });
      reply.clearCookie('tandara_resident_csrf', { path: '/' });
      return { ok: true };
    }
    if (!['login', 'register'].includes(action))
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Halaman tidak ditemukan.' } });
    const result = await this.residents.signIn(body, req.ip, action === 'register');
    reply.setCookie('tandara_resident', result.token, options);
    reply.setCookie('tandara_resident_csrf', result.csrf, { ...options, httpOnly: false });
    return { user: result.user };
  }
  user(req: FastifyRequest) {
    return this.identity.authenticate(
      req.cookies['tandara_session'],
      ['GET', 'HEAD'].includes(req.method) ? undefined : String(req.headers['x-csrf-token'] ?? ''),
    );
  }
  @Get('deployment') deployment() {
    const env = this.identity.database.environment;
    const origins = env.WEB_ORIGINS.split(',');
    return {
      mode: env.APP_MODE,
      residentOrigin: origins[0] || 'http://127.0.0.1:8080',
      coordinatorOrigin: origins[1] || 'http://127.0.0.1:8081',
    };
  }
  @Get('regions/:regionId/knowledge') knowledgeSearch(
    @Param('regionId') region: string,
    @Query('q') q: string,
  ) {
    return this.knowledge.search(region, q);
  }
  @Get('regions/:regionId/knowledge/references') async references(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.knowledge.references(await this.user(req), region);
  }
  @Post('regions/:regionId/knowledge/references') async importReference(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
    @Body() input: unknown,
  ) {
    return this.knowledge.importReference(await this.user(req), region, input);
  }
  @Post('regions/:regionId/knowledge/references/:id/review') async reviewReference(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() input: unknown,
  ) {
    return this.knowledge.reviewReference(await this.user(req), region, id, input);
  }
  @Post('regions/:regionId/ai/runs') async submitAi(
    @Param('regionId') region: string,
    @Body() input: unknown,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.submit(await this.user(req), region, input);
  }
  @Get('regions/:regionId/ai/runs') async aiRuns(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.list(await this.user(req), region);
  }
  @Get('regions/:regionId/ai/runs/:id') async aiRun(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.detail(await this.user(req), region, id);
  }
  @Post('regions/:regionId/ai/runs/:id/review') async reviewAi(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Body() input: unknown,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.review(await this.user(req), region, id, input);
  }
  @Post('regions/:regionId/ai/runs/:id/cancel') async cancelAi(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.cancel(await this.user(req), region, id);
  }
  @Post('regions/:regionId/ai/runs/:id/retry') async retryAi(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.retry(await this.user(req), region, id);
  }
  @Get('admin/ai/operations') async aiOperations(@Req() req: FastifyRequest) {
    return this.ai.operations(await this.user(req));
  }
  @Post('admin/ai/controls') async aiControl(@Req() req: FastifyRequest, @Body() input: unknown) {
    return this.ai.control(await this.user(req), input);
  }
  @Post('admin/ai/releases/:id/approve') async approveAiRelease(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() input: unknown,
  ) {
    return this.ai.approveRelease(await this.user(req), id, input);
  }
  @Post('admin/ai/releases/:id/evaluations') async registerEvaluation(
    @Param('id') id: string,
    @Body() input: unknown,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.registerEvaluation(await this.user(req), id, input);
  }
  @Post('admin/ai/releases/:id/activate') async activateAiRelease(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.ai.activateRelease(await this.user(req), id);
  }
  @Post('auth/login') async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const r = await this.identity.login(body, req.ip);
    const opts = {
      httpOnly: true,
      secure: process.env['SESSION_SECURE'] === 'true',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 28800,
    };
    reply.setCookie('tandara_session', r.token, opts);
    reply.setCookie('tandara_csrf', r.csrf, { ...opts, httpOnly: false });
    return { user: r.user, csrf: r.csrf };
  }
  @Get('auth/me') async me(@Req() req: FastifyRequest) {
    return { user: await this.user(req), csrf: req.cookies['tandara_csrf'] ?? '' };
  }
  @Post('auth/mfa/enroll') async beginMfa(@Req() req: FastifyRequest, @Body() body: unknown) {
    return this.identity.beginMfa(await this.user(req), body);
  }
  @Post('auth/mfa/confirm') async confirmMfa(@Req() req: FastifyRequest, @Body() body: unknown) {
    return this.identity.confirmMfa(await this.user(req), body);
  }
  @Post('auth/logout') async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.user(req);
    await this.identity.logout(req.cookies['tandara_session']!);
    reply.clearCookie('tandara_session', { path: '/' });
    reply.clearCookie('tandara_csrf', { path: '/' });
    return { ok: true };
  }
  @Get('regions') regions() {
    return this.identity.regions();
  }
  @Get('notifications') async notifications(@Req() req: FastifyRequest) {
    return this.identity.notifications(await this.user(req));
  }
  @Post('notifications/preferences') async preferences(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.identity.notificationPreference(await this.user(req), body);
  }
  @Post('notifications/:id/read') async readNotification(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.identity.readNotification(await this.user(req), id);
  }
  @Get('regions/:regionId/public') publicData(@Param('regionId') region: string) {
    return this.plans.publicData(region);
  }
  @Post('reports') async create(@Body() body: unknown, @Req() req: FastifyRequest) {
    const resident = await this.resident(req);
    if (req.headers['x-resident-id'] && req.headers['x-resident-id'] !== resident?.id)
      throw new ForbiddenException('Akun telah berubah. Muat ulang lalu coba lagi.');
    return this.reports.create(
      body,
      String(req.headers['idempotency-key'] ?? ''),
      req.ip,
      resident.id,
    );
  }
  @Get('reports/:id/tracking') track(@Param('id') id: string, @Req() req: FastifyRequest) {
    return this.reports.track(id, String(req.headers['x-tracking-token'] ?? ''));
  }
  @Get('reports/:id/workflow') async reportWorkflow(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    await this.reports.accessible(await this.user(req), id);
    return workflowDetail(this.reports, id);
  }
  @Post('reports/:id/workflow') async changeWorkflow(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return updateWorkflow(this.reports, await this.user(req), id, body);
  }
  @Post('reports/:id/feedback') async feedback(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    await this.residents.report(await this.resident(req), id);
    return citizenFeedback(this.reports, id, String(req.headers['x-tracking-token'] ?? ''), body);
  }
  @Get('regions/:regionId/team') async reportTeam(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return reportTeam(this.reports, await this.user(req), region);
  }
  @Get('regions/:regionId/report-analytics') async reportAnalytics(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return reportAnalytics(this.reports, await this.user(req), region);
  }
  @Post('reports/:id/deletion-request') async erase(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    await this.residents.report(await this.resident(req), id);
    return this.reports.eraseRequest(id, String(req.headers['x-tracking-token'] ?? ''));
  }
  @Post('reports/:id/attachments') async upload(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() input: unknown,
  ) {
    await this.residents.report(await this.resident(req), id);
    return this.reports.upload(id, String(req.headers['x-tracking-token'] ?? ''), input);
  }
  @Get('regions/:regionId/reports') async inbox(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.reports.inbox(await this.user(req), region, query);
  }
  @Get('reports/:id') async detail(@Param('id') id: string, @Req() req: FastifyRequest) {
    return this.reports.detail(await this.user(req), id);
  }
  @Post('reports/:id/reviews') async review(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.reports.review(await this.user(req), id, body);
  }
  @Post('reports/:id/triage') async regenerate(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.reports.regenerate(await this.user(req), id);
  }
  @Post('reports/:id/suggestions/:suggestionId/review') async aiReview(
    @Param('id') id: string,
    @Param('suggestionId') suggestion: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.reports.aiReview(await this.user(req), id, suggestion, body);
  }
  @Post('reports/:id/duplicates/:candidateId') async duplicate(
    @Param('id') id: string,
    @Param('candidateId') candidate: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.reports.duplicate(await this.user(req), id, candidate, body);
  }
  @Get('reports/:id/attachments/:attachmentId') async attachment(
    @Param('id') id: string,
    @Param('attachmentId') attachment: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const image = await this.reports.attachment(await this.user(req), id, attachment);
    reply
      .type('image/jpeg')
      .header('Content-Disposition', 'inline; filename="report.jpg"')
      .send(image);
  }
  @Get('regions/:regionId/plans') async managePlans(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.plans.managePlans(await this.user(req), region);
  }
  @Post('regions/:regionId/plans') async savePlan(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.plans.savePlan(await this.user(req), region, body);
  }
  @Put('regions/:regionId/plans/:id') async editPlan(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.plans.editPlan(await this.user(req), region, id, body);
  }
  @Post('regions/:regionId/plans/:id/transition') async transition(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.plans.planTransition(await this.user(req), region, id, body);
  }
  @Get('regions/:regionId/coverage') async coverage(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.plans.coverage(await this.user(req), region);
  }
  @Get('regions/:regionId/triage-summary') async groupSummary(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.plans.groupSummary(await this.user(req), region);
  }
  @Get('regions/:regionId/assistance') async assistance(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.plans.assistance(await this.user(req), region);
  }
  @Post('regions/:regionId/assistance/:id') async updateAssistance(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.plans.updateAssistance(await this.user(req), region, id, body);
  }
  @Get('regions/:regionId/training') training(@Param('regionId') region: string) {
    return this.plans.training(region);
  }
  @Get('regions/:regionId/training/outcomes') async trainingOutcomes(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    await this.identity.scope(await this.user(req), region);
    return this.plans.training(region, true);
  }
  @Post('regions/:regionId/training') async createTraining(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.plans.createTraining(await this.user(req), region, body);
  }
  @Post('regions/:regionId/training/:id/results') async completeTraining(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    await this.resident(req);
    return this.plans.completeTraining(region, id, body, req.ip);
  }
  @Get('regions/:regionId/sources') async sources(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
  ) {
    return this.admin.sources(await this.user(req), region);
  }
  @Post('regions/:regionId/sources') async saveSource(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.admin.saveSource(await this.user(req), region, body);
  }
  @Post('regions/:regionId/sources/:id/refresh') async refresh(
    @Param('regionId') region: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ) {
    return this.admin.refreshSource(await this.user(req), region, id);
  }
  @Get('regions/:regionId/audit') async audit(
    @Param('regionId') region: string,
    @Req() req: FastifyRequest,
    @Query('q') q?: string,
  ) {
    return this.admin.audit(await this.user(req), region, q);
  }
  @Get('admin/organizations') async organizations(@Req() req: FastifyRequest) {
    return this.admin.organizations(await this.user(req));
  }
  @Post('admin/organizations') async saveOrganization(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
  ) {
    return this.admin.saveOrganization(await this.user(req), body);
  }
  @Get('admin/users') async users(@Req() req: FastifyRequest) {
    return this.admin.users(await this.user(req));
  }
  @Get('admin/regions') async allRegions(@Req() req: FastifyRequest) {
    this.identity.requireAdmin(await this.user(req));
    return this.identity.regions(true);
  }
  @Post('admin/users') async saveUser(@Req() req: FastifyRequest, @Body() body: unknown) {
    return this.admin.saveUser(await this.user(req), body);
  }
  @Post('admin/regions') async saveRegion(@Req() req: FastifyRequest, @Body() body: unknown) {
    return this.admin.saveRegion(await this.user(req), body);
  }
  @Get('admin/operations') async operations(@Req() req: FastifyRequest) {
    return this.admin.operations(await this.user(req));
  }
  @Post('admin/jobs/:id/retry') async retry(@Req() req: FastifyRequest, @Param('id') id: string) {
    return this.admin.retryJob(await this.user(req), id);
  }
  @Post('admin/deletions/:id/complete') async deletion(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ) {
    return this.admin.deleteReport(await this.user(req), id);
  }
}
