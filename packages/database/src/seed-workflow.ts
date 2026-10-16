import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from './client.js';

/** Development-only fixtures. Stable IDs ensure reruns preserve operator edits. */
export async function seedWorkflow(db: Kysely<Database>) {
  const region = '20000000-0000-4000-8000-000000000001',
    coordinator = '30000000-0000-4000-8000-000000000001';
  const examples = [
    [
      'received',
      'road_flooding',
      'Genangan setinggi mata kaki di depan gang Melati. Kendaraan masih bisa lewat perlahan.',
      'Gang Melati, RT 03',
      'high',
    ],
    [
      'verified',
      'blocked_access',
      'Ranting pohon menutup sebagian akses menuju balai warga. Mohon bantuan membersihkan jalan.',
      'Jalan menuju balai warga',
      'normal',
    ],
    [
      'assigned',
      'water_entering_homes',
      'Air mulai masuk teras tiga rumah setelah hujan sore. Saluran depan rumah terlihat tersumbat.',
      'Gang Kenanga, RT 02',
      'urgent',
    ],
    [
      'in_progress',
      'road_flooding',
      'Genangan di persimpangan belum surut. Tim sedang memeriksa saluran air di sisi jalan.',
      'Simpang pasar, RT 04',
      'high',
    ],
    [
      'awaiting_approval',
      'blocked_access',
      'Sampah yang menutup selokan sudah diangkat. Aliran air kembali lancar dan jalan dapat dilalui.',
      'Jalan Mawar, RT 01',
      'normal',
    ],
    [
      'resolved',
      'road_flooding',
      'Genangan di depan pos ronda telah surut setelah saluran dibersihkan.',
      'Pos ronda, RT 05',
      'normal',
    ],
    [
      'closed',
      'other',
      'Penerangan di pintu balai warga kembali berfungsi setelah kabel diperbaiki.',
      'Balai warga, RT 03',
      'normal',
    ],
    [
      'needs_information',
      'other',
      'Ada aliran air dari arah kebun. Lokasi tepat dan waktu kejadian perlu dikonfirmasi.',
      'Dekat kebun warga',
      'normal',
    ],
  ] as const;
  await db.transaction().execute(async (tx) => {
    for (const [i, [status, category, description, landmark, priority]] of examples.entries()) {
      const id = `41000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
      const assigned = [
        'assigned',
        'in_progress',
        'awaiting_approval',
        'resolved',
        'closed',
      ].includes(status);
      const state =
        status === 'closed'
          ? 'closed'
          : status === 'received'
            ? 'submitted'
            : status === 'needs_information'
              ? 'clarification_requested'
              : 'reviewed';
      const inserted =
        await sql`INSERT INTO reports(id,region_id,category,description,landmark_text,observation_time,tracking_hash,idempotency_key,payload_hash,workflow_status,state,assignee_id,priority,resolution_author_id,simulation,created_at) VALUES(${id}::uuid,${region}::uuid,${category},${description},${landmark},now(),${'development-workflow-' + id},${id}::uuid,'development-workflow',${status},${state},${assigned ? coordinator : null}::uuid,${priority},${['awaiting_approval', 'resolved', 'closed'].includes(status) ? coordinator : null}::uuid,true,now()-${i}*interval '2 hours') ON CONFLICT DO NOTHING RETURNING id`.execute(
          tx,
        );
      if (inserted.rows.length && status !== 'received')
        await sql`INSERT INTO report_updates(report_id,actor_id,action,message,rating) VALUES(${id}::uuid,${coordinator}::uuid,${status},${status === 'needs_information' ? 'Mohon informasikan patokan lokasi terdekat dan waktu pengamatan.' : description},${status === 'closed' ? 5 : null})`.execute(
          tx,
        );
      await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('triage',${id}::uuid,${region}::uuid,${`seed-workflow-triage-${id}`}) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
    }
  });
}
