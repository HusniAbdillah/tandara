import { ForbiddenException } from '@nestjs/common';
import { sql } from 'kysely';
import { z } from 'zod';
import { workflowActionSchema, citizenFeedbackSchema } from '@tandara/contracts';
import type { Workflow, User } from '@tandara/contracts';
import type { ReportsService } from './reports.js';
import { audit, conflict, found, hash, parse, workflowProjection } from './shared.js';
import { workflowDecision } from './report-workflow-policy.js';

export async function workflowDetail(service: ReportsService, id: string, citizen = false) {
  const workflow = found(
    (
      await sql<{
        data: Workflow;
      }>`SELECT ${workflowProjection} data FROM reports r WHERE id=${id}::uuid`.execute(service.db)
    ).rows[0],
  ).data;
  const events = (
    await sql`SELECT e.id,e.action,e.message,${citizen ? sql`NULL` : sql`u.name`} actor,e.created_at::text AS "createdAt" FROM report_updates e LEFT JOIN users u ON u.id=e.actor_id WHERE e.report_id=${id}::uuid ORDER BY e.created_at,e.id`.execute(
      service.db,
    )
  ).rows;
  return {
    workflow: citizen ? { ...workflow, assigneeId: null, assigneeName: null } : workflow,
    events,
  };
}

export async function updateWorkflow(
  service: ReportsService,
  user: User,
  id: string,
  input: unknown,
) {
  const region = await service.accessible(user, id);
  const data = parse(workflowActionSchema, input);
  return service.db.transaction().execute(async (tx) => {
    const row = found(
      (
        await sql<{
          workflow: Workflow;
          author: string | null;
        }>`SELECT ${workflowProjection} workflow,r.resolution_author_id author FROM reports r WHERE r.id=${id}::uuid AND NOT r.erased FOR UPDATE`.execute(
          tx,
        )
      ).rows[0],
    );
    if (row.workflow.revision !== data.revision)
      conflict('Laporan sudah diperbarui. Muat status terbaru; isian Anda tetap tersimpan.');
    const decision = workflowDecision(user, row.workflow, data.action, row.author);
    if (decision.error) throw new ForbiddenException(decision.error);
    if (data.action === 'assign') {
      if (!data.assigneeId) conflict('Pilih koordinator penanggung jawab.');
      const assignee = (
        await sql`SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=${data.assigneeId}::uuid AND m.region_id=${region}::uuid AND u.role='coordinator' AND NOT u.suspended FOR SHARE OF u,m`.execute(
          tx,
        )
      ).rows[0];
      if (!assignee) conflict('Koordinator tidak aktif atau tidak memiliki akses wilayah ini.');
    }
    const status = decision.status!;
    const legacyState =
      status === 'rejected'
        ? 'rejected'
        : status === 'needs_information'
          ? 'clarification_requested'
          : ['verified', 'assigned', 'in_progress', 'awaiting_approval', 'resolved'].includes(
                status,
              )
            ? 'reviewed'
            : 'under_review';
    await sql`UPDATE reports SET workflow_status=${status},state=${legacyState},assignee_id=CASE WHEN ${data.action}='assign' THEN ${data.assigneeId ?? null}::uuid ELSE assignee_id END,priority=COALESCE(${data.priority ?? null},priority),resolution_author_id=CASE WHEN ${data.action}='submit_resolution' THEN ${user.id}::uuid ELSE resolution_author_id END,publish_on_map=CASE WHEN ${status} IN ('rejected','needs_information','closed') THEN false WHEN ${status} IN ('verified','assigned','in_progress','awaiting_approval','resolved') THEN (location IS NOT NULL AND NOT follow_up_requested) ELSE publish_on_map END,revision=revision+1,updated_at=now(),reviewed_by=${user.id}::uuid,reviewed_at=now(),public_summary=CASE WHEN ${status} IN ('rejected','needs_information') THEN NULL ELSE public_summary END WHERE id=${id}::uuid`.execute(
      tx,
    );
    await sql`INSERT INTO report_updates(report_id,actor_id,action,message) VALUES(${id}::uuid,${user.id}::uuid,${status},${data.message})`.execute(
      tx,
    );
    await sql`UPDATE assistance_requests SET state=${['assigned', 'in_progress'].includes(status) ? status : status === 'resolved' ? 'in_progress' : 'received'},updated_at=now() WHERE report_id=${id}::uuid`.execute(
      tx,
    );
    await audit(tx, user.id, region, 'report.workflow.' + data.action, id, { status });
    await sql`INSERT INTO notifications(user_id,region_id,title) SELECT u.id,${region}::uuid,${'Laporan #' + id.slice(0, 8) + ': ' + data.message.slice(0, 160)} FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE NOT u.suspended AND COALESCE(p.enabled,true) AND (u.role='admin' OR u.id=COALESCE(${data.assigneeId ?? null}::uuid,${row.workflow.assigneeId}::uuid))`.execute(
      tx,
    );
    return { ok: true };
  });
}

export async function citizenFeedback(
  service: ReportsService,
  id: string,
  token: string | undefined,
  input: unknown,
  residentId?: string,
) {
  parse(z.uuid(), id);
  const data = parse(citizenFeedbackSchema, input);
  return service.db.transaction().execute(async (tx) => {
    const row = found(
      (
        await sql<{
          status: string;
          revision: number;
          region: string;
        }>`SELECT workflow_status status,revision,region_id region FROM reports WHERE id=${id}::uuid AND (tracking_hash=${hash(token ?? '')} OR resident_id=${residentId ?? null}::uuid) AND NOT erased FOR UPDATE`.execute(
          tx,
        )
      ).rows[0],
    );
    if (row.revision !== data.revision) conflict();
    if (data.action === 'clarify' ? row.status !== 'needs_information' : row.status !== 'resolved')
      conflict('Tanggapan tidak tersedia untuk status laporan ini.');
    const status =
      data.action === 'confirm' ? 'closed' : data.action === 'reopen' ? 'in_progress' : 'received';
    await sql`UPDATE reports SET workflow_status=${status},state=${status === 'closed' ? 'closed' : status === 'received' ? 'submitted' : 'reviewed'},updated_at=now(),revision=revision+1 WHERE id=${id}::uuid`.execute(
      tx,
    );
    await sql`INSERT INTO report_updates(report_id,action,message,rating) VALUES(${id}::uuid,${status},${data.message},${data.action === 'confirm' ? (data.rating ?? null) : null})`.execute(
      tx,
    );
    await sql`UPDATE assistance_requests SET state=${status === 'closed' ? 'closed' : status === 'in_progress' ? 'in_progress' : 'received'},updated_at=now() WHERE report_id=${id}::uuid`.execute(
      tx,
    );
    await audit(tx, null, row.region, 'report.citizen.' + data.action, id);
    await sql`INSERT INTO notifications(user_id,region_id,title) SELECT u.id,${row.region}::uuid,${'Warga menanggapi laporan #' + id.slice(0, 8)} FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE NOT u.suspended AND COALESCE(p.enabled,true) AND (u.role='admin' OR u.id=(SELECT assignee_id FROM reports WHERE id=${id}::uuid))`.execute(
      tx,
    );
    return { ok: true };
  });
}

export async function reportTeam(service: ReportsService, user: User, region: string) {
  await service.identity.scope(user, region);
  return (
    await sql`SELECT u.id,u.name,u.role,(SELECT count(*)::int FROM reports r WHERE r.assignee_id=u.id AND r.region_id=${region}::uuid AND NOT r.erased AND r.workflow_status NOT IN ('closed','rejected','resolved')) AS "activeReports" FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.region_id=${region}::uuid AND NOT u.suspended ORDER BY u.name`.execute(
      service.db,
    )
  ).rows;
}

export async function reportAnalytics(service: ReportsService, user: User, region: string) {
  await service.identity.scope(user, region);
  const rows = (
    await sql<{
      status: string;
      category: string;
      count: number;
      urgent: number;
      unassigned: number;
    }>`SELECT workflow_status status,category,count(*)::int count,count(*) FILTER(WHERE priority='urgent' AND workflow_status NOT IN ('closed','rejected','resolved'))::int urgent,count(*) FILTER(WHERE assignee_id IS NULL AND workflow_status NOT IN ('closed','rejected','resolved'))::int unassigned FROM reports WHERE region_id=${region}::uuid AND NOT erased GROUP BY workflow_status,category`.execute(
      service.db,
    )
  ).rows;
  const ratings = (
    await sql<{
      averageRating: number | null;
      feedbackCount: number;
    }>`SELECT avg(e.rating)::float8 AS "averageRating",count(e.rating)::int AS "feedbackCount" FROM report_updates e JOIN reports r ON r.id=e.report_id WHERE r.region_id=${region}::uuid AND NOT r.erased`.execute(
      service.db,
    )
  ).rows[0]!;
  const daily = (
    await sql`SELECT to_char(created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') AS "day",count(*)::int count FROM reports WHERE region_id=${region}::uuid AND NOT erased AND created_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 1`.execute(
      service.db,
    )
  ).rows;
  const byStatus: Record<string, number> = {},
    byCategory: Record<string, number> = {};
  let total = 0,
    urgent = 0,
    unassigned = 0;
  for (const r of rows) {
    total += r.count;
    urgent += r.urgent;
    unassigned += r.unassigned;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + r.count;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.count;
  }
  return { total, urgent, unassigned, byStatus, byCategory, daily, ...ratings };
}
