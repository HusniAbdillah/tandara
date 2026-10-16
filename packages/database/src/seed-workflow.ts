import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from './client.js';
import { demoAccounts } from './demo-accounts.js';

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

/** Resident-owned scenarios exercise both sides of the report and feedback flow. */
export async function seedResidentReports(db: Kysely<Database>) {
  const regions = {
    ciliwung: '20000000-0000-4000-8000-000000000001',
    semarang: '20000000-0000-4000-8000-000000000002',
  } as const;
  const expectedRegions = [
    [regions.ciliwung, 'Kampung Ciliwung'],
    [regions.semarang, 'Pesisir Semarang'],
  ] as const;
  const existingRegions = await sql<{ id: string; name: string }>`
    SELECT id::text AS id,name FROM regions
    WHERE id=ANY(${expectedRegions.map(([id]) => id)}::uuid[])
  `.execute(db);
  const existingRegionNames = new Map(
    existingRegions.rows.map((region) => [region.id, region.name]),
  );
  for (const [id, name] of expectedRegions) {
    if (existingRegionNames.get(id) !== name)
      throw new Error(
        `Resident report seed requires the existing ${name} region; no regions are created.`,
      );
  }
  const organizations = {
    ciliwung: '10000000-0000-4000-8000-000000000001',
    semarang: '10000000-0000-4000-8000-000000000002',
  } as const;
  const coordinators = {
    ciliwung: demoAccounts.coordinators[0]!.id,
    semarang: demoAccounts.coordinators[1]!.id,
  } as const;
  const admin = demoAccounts.coordinators[2]!.id;
  const residents = {
    ciliwung: demoAccounts.residents[0]!.id,
    semarang: demoAccounts.residents[1]!.id,
  } as const;
  const examples = [
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 1,
      daysAgo: 0,
      category: 'road_flooding',
      status: 'received',
      priority: 'high',
      description:
        'Genangan mulai terlihat di depan Gang Melati setelah hujan siang. Pejalan kaki masih dapat lewat dari sisi kiri.',
      landmark: 'Gang Melati, RT 03',
      longitude: 106.86,
      latitude: -6.218,
      events: [],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 2,
      daysAgo: 1,
      category: 'other',
      status: 'needs_information',
      priority: 'normal',
      description:
        'Ada aliran air dari arah kebun dekat rumah. Patokan lokasi dan waktu kejadian belum disebutkan.',
      landmark: 'Dekat kebun warga',
      longitude: null,
      latitude: null,
      events: [
        {
          status: 'needs_information',
          message:
            'Mohon tambahkan patokan terdekat dan perkiraan waktu kejadian agar koordinator dapat memeriksa lokasi.',
          actor: coordinators.ciliwung,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 3,
      daysAgo: 2,
      category: 'blocked_access',
      status: 'assigned',
      priority: 'normal',
      description:
        'Ranting pohon menutup sebagian jalan menuju balai warga. Satu jalur kecil masih bisa dilalui pejalan kaki.',
      landmark: 'Jalan menuju balai warga, RT 02',
      longitude: 106.863,
      latitude: -6.219,
      events: [
        {
          status: 'verified',
          message: 'Koordinator telah memeriksa keterangan dan patokan lokasi laporan.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Admin menugaskan Koordinator Ciliwung untuk memeriksa akses jalan.',
          actor: admin,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 4,
      daysAgo: 3,
      category: 'water_entering_homes',
      status: 'in_progress',
      priority: 'urgent',
      description:
        'Air hujan masuk ke halaman dua rumah di Gang Kenanga. Warga melihat saluran depan rumah tertutup sampah.',
      landmark: 'Gang Kenanga, RT 02',
      longitude: 106.865,
      latitude: -6.22,
      events: [
        {
          status: 'verified',
          message:
            'Laporan sudah diperiksa koordinator. Kebutuhan warga dicatat untuk ditindaklanjuti.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Koordinator lapangan ditugaskan untuk memeriksa saluran di lokasi.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Petugas sedang memeriksa saluran dan kondisi halaman bersama warga sekitar.',
          actor: coordinators.ciliwung,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 5,
      daysAgo: 5,
      category: 'blocked_access',
      status: 'awaiting_approval',
      priority: 'high',
      description:
        'Sampah dan ranting menutup saluran di Jalan Mawar. Tim melaporkan pembersihan sudah dilakukan.',
      landmark: 'Jalan Mawar, RT 01',
      longitude: 106.858,
      latitude: -6.214,
      events: [
        {
          status: 'verified',
          message: 'Lokasi dan keterangan laporan telah diverifikasi.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Koordinator ditugaskan untuk mengecek saluran di Jalan Mawar.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Tim warga sedang membersihkan sumbatan dari saluran.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'awaiting_approval',
          message: 'Pembersihan selesai dan aliran mulai lancar. Hasil sedang ditinjau Admin.',
          actor: coordinators.ciliwung,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 6,
      daysAgo: 7,
      category: 'road_flooding',
      status: 'resolved',
      priority: 'normal',
      description:
        'Genangan di dekat pos ronda sudah surut setelah saluran diperiksa dan dibersihkan.',
      landmark: 'Pos ronda, RT 05',
      longitude: 106.862,
      latitude: -6.216,
      events: [
        {
          status: 'verified',
          message: 'Laporan diteruskan kepada koordinator wilayah.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Koordinator wilayah ditugaskan untuk memeriksa genangan.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Saluran di sekitar pos ronda sedang diperiksa.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'awaiting_approval',
          message: 'Koordinator melaporkan genangan sudah surut dan meminta tinjauan Admin.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'resolved',
          message: 'Admin menyetujui hasil penanganan. Silakan periksa kembali kondisi di lokasi.',
          actor: admin,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 7,
      daysAgo: 10,
      category: 'other',
      status: 'closed',
      priority: 'normal',
      description:
        'Lampu penerangan di pintu balai warga sempat padam dan telah menyala kembali setelah diperiksa pengelola.',
      landmark: 'Balai warga, RT 03',
      longitude: 106.861,
      latitude: -6.217,
      events: [
        {
          status: 'verified',
          message: 'Keterangan dan lokasi laporan telah diperiksa.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Koordinator menghubungi pengelola untuk memeriksa penerangan.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Pengelola sedang memeriksa lampu di pintu balai.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'awaiting_approval',
          message: 'Lampu sudah menyala kembali. Hasil menunggu persetujuan Admin.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'resolved',
          message: 'Admin menyetujui hasil perbaikan. Mohon konfirmasi kondisi terakhir.',
          actor: admin,
        },
        {
          status: 'closed',
          message:
            'Warga mengonfirmasi lampu kembali berfungsi. Terima kasih atas tindak lanjutnya.',
          actor: null,
          rating: 5,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 8,
      daysAgo: 12,
      category: 'other',
      status: 'rejected',
      priority: 'normal',
      description:
        'Laporan ganda mengenai genangan di depan balai warga; laporan utama sudah ditangani dan kondisi lokasi diperiksa.',
      landmark: 'Depan balai warga, RT 03',
      longitude: 106.861,
      latitude: -6.217,
      events: [
        {
          status: 'verified',
          message: 'Koordinator membandingkan laporan dengan laporan lain di lokasi yang sama.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'rejected',
          message:
            'Laporan ini ditutup sebagai laporan ganda. Laporan utama tetap dapat dilihat pada antrean Posko.',
          actor: admin,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 1,
      daysAgo: 0,
      category: 'road_flooding',
      status: 'received',
      priority: 'high',
      description:
        'Air hujan menggenang di ujung Jalan Kenari setelah hujan sore. Warga melihat air mengalir ke arah selokan.',
      landmark: 'Jalan Kenari, RW 06',
      longitude: 110.42,
      latitude: -6.963,
      events: [],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 2,
      daysAgo: 1,
      category: 'water_entering_homes',
      status: 'assigned',
      priority: 'urgent',
      description:
        'Air masuk ke teras satu rumah dekat tikungan. Pemilik rumah sudah memindahkan barang dari lantai bawah.',
      landmark: 'Tikungan Jalan Cempaka, RW 06',
      longitude: 110.423,
      latitude: -6.961,
      events: [
        {
          status: 'verified',
          message: 'Informasi dan lokasi telah diperiksa Koordinator Semarang.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Koordinator lapangan ditugaskan memeriksa kondisi rumah dan saluran sekitar.',
          actor: admin,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 3,
      daysAgo: 2,
      category: 'blocked_access',
      status: 'in_progress',
      priority: 'normal',
      description:
        'Ranting dan daun menutupi sebagian saluran di tepi Jalan Anggrek. Pengendara dapat melewati sisi seberang.',
      landmark: 'Jalan Anggrek, RW 04',
      longitude: 110.417,
      latitude: -6.966,
      events: [
        {
          status: 'verified',
          message: 'Laporan telah ditinjau dan diteruskan ke Koordinator Semarang.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Pemeriksaan lapangan telah ditugaskan.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Koordinator sedang memeriksa saluran bersama pengurus lingkungan.',
          actor: coordinators.semarang,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 4,
      daysAgo: 4,
      category: 'other',
      status: 'needs_information',
      priority: 'normal',
      description:
        'Air terlihat mengalir dekat rumah warga, tetapi sisi jalan dan patokan bangunan belum disebutkan.',
      landmark: 'Sekitar RW 06',
      longitude: null,
      latitude: null,
      events: [
        {
          status: 'needs_information',
          message: 'Mohon sebutkan nama jalan atau bangunan terdekat dan waktu pengamatan.',
          actor: coordinators.semarang,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 5,
      daysAgo: 8,
      category: 'follow_up_needed',
      status: 'closed',
      priority: 'normal',
      followUp: true,
      description:
        'Warga meminta pendataan kebutuhan pompa portabel untuk kerja bakti setelah saluran diperiksa.',
      landmark: 'Pos lingkungan RW 06',
      longitude: 110.42,
      latitude: -6.963,
      events: [
        {
          status: 'verified',
          message:
            'Koordinator mengonfirmasi permintaan sebagai tindak lanjut komunitas, bukan panggilan darurat.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Admin menugaskan Koordinator Semarang untuk menghubungi pengurus lingkungan.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Pengurus telah memperoleh jadwal pemeriksaan peralatan komunitas.',
          actor: coordinators.semarang,
        },
        {
          status: 'awaiting_approval',
          message: 'Koordinator melaporkan pendataan selesai dan meminta tinjauan.',
          actor: coordinators.semarang,
        },
        {
          status: 'resolved',
          message: 'Admin menyetujui tindak lanjut. Warga diminta mengonfirmasi hasil.',
          actor: admin,
        },
        {
          status: 'closed',
          message: 'Warga menyatakan informasi peralatan sudah diterima.',
          actor: null,
          rating: 4,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 9,
      daysAgo: 0,
      category: 'road_flooding',
      status: 'received',
      priority: 'normal',
      description:
        'Air menggenang di sisi jalan dekat jembatan kecil setelah hujan deras. Kendaraan roda dua masih dapat lewat pelan.',
      landmark: 'Jembatan kecil, RT 04',
      longitude: 106.857,
      latitude: -6.216,
      events: [],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 10,
      daysAgo: 1,
      category: 'blocked_access',
      status: 'verified',
      priority: 'high',
      description:
        'Material ranting menutup sebagian jalur setapak menuju taman baca. Jalur utama masih bisa dilewati.',
      landmark: 'Taman baca RW 03',
      longitude: 106.864,
      latitude: -6.215,
      events: [
        {
          status: 'verified',
          message: 'Koordinator telah memeriksa patokan lokasi dan kondisi jalur.',
          actor: coordinators.ciliwung,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 11,
      daysAgo: 2,
      category: 'water_entering_homes',
      status: 'assigned',
      priority: 'urgent',
      description:
        'Air mulai masuk ke halaman rumah di tepi saluran. Warga telah memindahkan barang dari area rendah.',
      landmark: 'Gang Nusa Indah, RT 06',
      longitude: 106.859,
      latitude: -6.221,
      events: [
        {
          status: 'verified',
          message: 'Koordinator mengonfirmasi laporan dan mencatat kondisi halaman.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Admin menugaskan pemeriksaan saluran di sekitar rumah warga.',
          actor: admin,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 12,
      daysAgo: 4,
      category: 'road_flooding',
      status: 'in_progress',
      priority: 'high',
      description:
        'Genangan di persimpangan dekat pasar belum surut. Petugas sedang membuka sumbatan di mulut drainase.',
      landmark: 'Persimpangan Pasar Warga, RT 01',
      longitude: 106.855,
      latitude: -6.218,
      events: [
        {
          status: 'verified',
          message: 'Lokasi dan waktu genangan telah dikonfirmasi oleh koordinator.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Tim lapangan ditugaskan memeriksa saluran di persimpangan.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Petugas sedang membersihkan sumbatan dan memantau aliran air.',
          actor: coordinators.ciliwung,
        },
      ],
    },
    {
      region: 'ciliwung',
      resident: 'ciliwung',
      sequence: 13,
      daysAgo: 6,
      category: 'blocked_access',
      status: 'closed',
      priority: 'normal',
      description:
        'Ranting yang menghalangi jalan menuju balai warga sudah dibersihkan dan akses kembali terbuka.',
      landmark: 'Jalan menuju balai warga, RT 02',
      longitude: 106.863,
      latitude: -6.219,
      events: [
        {
          status: 'verified',
          message: 'Laporan dan kondisi akses telah diverifikasi di lokasi.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'assigned',
          message: 'Koordinator menugaskan tim untuk memindahkan ranting.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Tim sedang membersihkan jalur bersama pengurus setempat.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'awaiting_approval',
          message: 'Jalur sudah terbuka dan hasil pekerjaan menunggu tinjauan Admin.',
          actor: coordinators.ciliwung,
        },
        {
          status: 'resolved',
          message: 'Admin menyetujui hasil penanganan dan meminta konfirmasi warga.',
          actor: admin,
        },
        {
          status: 'closed',
          message: 'Warga mengonfirmasi jalur dapat digunakan kembali.',
          actor: null,
          rating: 5,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 6,
      daysAgo: 0,
      category: 'road_flooding',
      status: 'verified',
      priority: 'high',
      description:
        'Genangan terlihat di depan halte setelah hujan malam. Warga mengamati air mulai masuk ke saluran tepi jalan.',
      landmark: 'Halte Jalan Kenari, RW 05',
      longitude: 110.421,
      latitude: -6.959,
      events: [
        {
          status: 'verified',
          message: 'Koordinator Semarang telah memeriksa lokasi dan waktu laporan.',
          actor: coordinators.semarang,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 7,
      daysAgo: 1,
      category: 'blocked_access',
      status: 'assigned',
      priority: 'normal',
      description:
        'Daun dan lumpur menumpuk di saluran dekat sekolah. Akses pejalan kaki masih terbuka dari sisi timur.',
      landmark: 'Samping SD Pesisir, RW 04',
      longitude: 110.416,
      latitude: -6.965,
      events: [
        {
          status: 'verified',
          message: 'Koordinator mengonfirmasi lokasi sumbatan dengan pengurus lingkungan.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Admin menugaskan tim untuk memeriksa aliran saluran di dekat sekolah.',
          actor: admin,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 8,
      daysAgo: 2,
      category: 'water_entering_homes',
      status: 'in_progress',
      priority: 'urgent',
      description:
        'Air mencapai teras beberapa rumah saat pasang tinggi. Pengurus lingkungan membantu memantau ketinggian air.',
      landmark: 'Kampung Tambak Baru, RW 07',
      longitude: 110.426,
      latitude: -6.967,
      events: [
        {
          status: 'verified',
          message: 'Laporan pasang dan lokasi rumah telah dikonfirmasi koordinator.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Koordinator lapangan ditugaskan memantau rumah yang terdampak.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Pemantauan bersama pengurus sedang berjalan; warga diminta menjauhi aliran.',
          actor: coordinators.semarang,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 9,
      daysAgo: 3,
      category: 'road_flooding',
      status: 'awaiting_approval',
      priority: 'high',
      description:
        'Genangan di akses menuju dermaga lingkungan telah surut setelah saluran dibersihkan.',
      landmark: 'Akses dermaga RW 05',
      longitude: 110.424,
      latitude: -6.96,
      events: [
        {
          status: 'verified',
          message: 'Koordinator memeriksa genangan dan jalur akses yang terdampak.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Tim kebersihan saluran ditugaskan menangani sumbatan.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Tim membersihkan saluran dan memantau permukaan air.',
          actor: coordinators.semarang,
        },
        {
          status: 'awaiting_approval',
          message: 'Penanganan selesai dan menunggu pemeriksaan akhir Admin.',
          actor: coordinators.semarang,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 10,
      daysAgo: 5,
      category: 'blocked_access',
      status: 'resolved',
      priority: 'normal',
      description:
        'Jalur menuju pos lingkungan kembali terbuka setelah pasir yang menumpuk diangkat.',
      landmark: 'Pos lingkungan RW 03',
      longitude: 110.415,
      latitude: -6.969,
      events: [
        {
          status: 'verified',
          message: 'Koordinator memastikan jalur dan titik tumpukan pasir.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Admin menugaskan tim lingkungan untuk membuka kembali akses.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Tim telah mengangkat pasir dari jalur menuju pos.',
          actor: coordinators.semarang,
        },
        {
          status: 'awaiting_approval',
          message: 'Hasil pekerjaan dikirim ke Admin untuk ditinjau.',
          actor: coordinators.semarang,
        },
        {
          status: 'resolved',
          message: 'Admin menyetujui hasil dan meminta warga memastikan akses aman.',
          actor: admin,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 11,
      daysAgo: 7,
      category: 'follow_up_needed',
      status: 'closed',
      priority: 'normal',
      followUp: true,
      description:
        'Warga meminta jadwal pemeriksaan pompa lingkungan dibagikan setelah perawatan selesai.',
      landmark: 'Rumah pompa RW 02',
      longitude: 110.419,
      latitude: -6.971,
      events: [
        {
          status: 'verified',
          message: 'Koordinator mengonfirmasi kebutuhan informasi jadwal pemeriksaan pompa.',
          actor: coordinators.semarang,
        },
        {
          status: 'assigned',
          message: 'Admin meminta koordinator menghubungi pengelola rumah pompa.',
          actor: admin,
        },
        {
          status: 'in_progress',
          message: 'Jadwal perawatan sudah diminta kepada pengelola.',
          actor: coordinators.semarang,
        },
        {
          status: 'awaiting_approval',
          message: 'Informasi jadwal telah dihimpun dan menunggu tinjauan Admin.',
          actor: coordinators.semarang,
        },
        {
          status: 'resolved',
          message: 'Admin menyetujui tindak lanjut dan mengirim informasi kepada warga.',
          actor: admin,
        },
        {
          status: 'closed',
          message: 'Warga mengonfirmasi jadwal perawatan telah diterima.',
          actor: null,
          rating: 4,
        },
      ],
    },
    {
      region: 'semarang',
      resident: 'semarang',
      sequence: 12,
      daysAgo: 9,
      category: 'other',
      status: 'rejected',
      priority: 'normal',
      description:
        'Laporan berada di luar wilayah Posko Semarang dan warga diarahkan ke kanal pengaduan setempat.',
      landmark: 'Jalan Kabupaten, luar batas wilayah',
      longitude: 110.451,
      latitude: -6.952,
      events: [
        {
          status: 'verified',
          message:
            'Koordinator memeriksa lokasi dan memastikan titik berada di luar wilayah layanan.',
          actor: coordinators.semarang,
        },
        {
          status: 'rejected',
          message: 'Laporan ditutup di Posko ini dan warga diarahkan ke kanal wilayah yang sesuai.',
          actor: admin,
        },
      ],
    },
  ] as const;

  await db.transaction().execute(async (tx) => {
    const hasPhone = Boolean(
      (
        await sql<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'report_private_details' AND column_name = 'resident_phone'
          ) AS exists
        `.execute(tx)
      ).rows[0]?.exists,
    );

    for (const report of examples) {
      const id = `42000000-0000-4000-8000-${report.region === 'ciliwung' ? '1' : '2'}${String(report.sequence).padStart(11, '0')}`;
      const regionId = regions[report.region];
      const coordinatorId = coordinators[report.region];
      const residentId = residents[report.resident];
      const receivedAt = new Date(Date.now() - report.daysAgo * 24 * 60 * 60 * 1000);
      const state =
        report.status === 'received'
          ? 'submitted'
          : report.status === 'needs_information'
            ? 'clarification_requested'
            : report.status === 'rejected'
              ? 'rejected'
              : report.status === 'closed'
                ? 'closed'
                : 'reviewed';
      const active = !['received', 'needs_information', 'rejected', 'closed'].includes(
        report.status,
      );
      const hasAssignee = [
        'assigned',
        'in_progress',
        'awaiting_approval',
        'resolved',
        'closed',
      ].includes(report.status);
      const resolutionAuthor = ['awaiting_approval', 'resolved', 'closed'].includes(report.status)
        ? coordinatorId
        : null;
      const latestAt = new Date(receivedAt.getTime() + report.events.length * 8 * 60 * 1000);
      const lastStaffEventIndex = report.events.reduce(
        (latest, event, index) => (event.actor ? index : latest),
        -1,
      );
      const reviewedBy = lastStaffEventIndex < 0 ? null : report.events[lastStaffEventIndex]!.actor;
      const reviewedAt =
        lastStaffEventIndex < 0
          ? null
          : new Date(receivedAt.getTime() + (lastStaffEventIndex + 1) * 8 * 60 * 1000);
      const inserted = await sql<{ id: string }>`
        INSERT INTO reports(
          id,region_id,category,description,landmark_text,observation_time,location,
          follow_up_requested,tracking_hash,idempotency_key,payload_hash,workflow_status,state,
          assignee_id,priority,resolution_author_id,reviewed_by,reviewed_at,simulation,
          resident_id,created_at,updated_at,revision
        ) VALUES(
          ${id}::uuid,${regionId}::uuid,${report.category},${report.description},${report.landmark},
          ${receivedAt.toISOString()}::timestamptz,
          CASE WHEN ${report.longitude ?? null}::float IS NULL THEN NULL
            ELSE ST_SetSRID(ST_MakePoint(${report.longitude ?? null},${report.latitude ?? null}),4326) END,
          ${'followUp' in report ? report.followUp : false},${'development-resident-' + id},
          ${id}::uuid,${'development-resident-' + id},${report.status},${state},
          ${hasAssignee ? coordinatorId : null}::uuid,${report.priority},${resolutionAuthor}::uuid,
          ${reviewedBy}::uuid,${reviewedAt?.toISOString() ?? null}::timestamptz,true,${residentId}::uuid,
          ${receivedAt.toISOString()}::timestamptz,${latestAt.toISOString()}::timestamptz,
          ${report.events.length + 1}
        ) ON CONFLICT DO NOTHING RETURNING id`.execute(tx);
      if (!inserted.rows.length) continue;

      await sql`INSERT INTO report_history(report_id,action,reason,created_at)
        VALUES(${id}::uuid,'submitted','Laporan diterima dari akun Warga demo.',${receivedAt.toISOString()}::timestamptz)`.execute(
        tx,
      );
      if (hasPhone) {
        await sql`INSERT INTO report_private_details(report_id,resident_phone,consent_at,retention_until)
          SELECT r.id,a.phone,r.created_at,r.created_at+(g.config->>'retentionDays')::int*interval '1 day'
          FROM reports r JOIN residents a ON a.id=r.resident_id JOIN regions g ON g.id=r.region_id
          WHERE r.id=${id}::uuid AND NOT r.erased
            AND r.created_at+(g.config->>'retentionDays')::int*interval '1 day'>now()
          ON CONFLICT(report_id) DO NOTHING`.execute(tx);
      } else {
        await sql`INSERT INTO report_private_details(report_id,consent_at,retention_until)
          SELECT r.id,r.created_at,r.created_at+(g.config->>'retentionDays')::int*interval '1 day'
          FROM reports r JOIN regions g ON g.id=r.region_id
          WHERE r.id=${id}::uuid AND NOT r.erased
            AND r.created_at+(g.config->>'retentionDays')::int*interval '1 day'>now()
          ON CONFLICT(report_id) DO NOTHING`.execute(tx);
      }
      if ('followUp' in report && report.followUp)
        await sql`INSERT INTO assistance_requests(report_id,region_id,state,organization_id,note,updated_at)
          VALUES(${id}::uuid,${regionId}::uuid,
            ${report.status === 'closed' ? 'closed' : active ? 'in_progress' : 'received'},
            ${report.status === 'closed' ? organizations[report.region] : null}::uuid,
            ${report.status === 'closed' ? 'Informasi kebutuhan komunitas telah disampaikan dan dikonfirmasi warga.' : ''},
            ${latestAt.toISOString()}::timestamptz) ON CONFLICT(report_id) DO NOTHING`.execute(tx);
      for (const [index, event] of report.events.entries()) {
        const eventAt = new Date(receivedAt.getTime() + (index + 1) * 8 * 60 * 1000);
        await sql`INSERT INTO report_updates(report_id,actor_id,action,message,rating,created_at)
          VALUES(${id}::uuid,${event.actor}::uuid,${event.status},${event.message},
            ${'rating' in event ? event.rating : null},${eventAt.toISOString()}::timestamptz)`.execute(
          tx,
        );
      }
      const title = `Laporan warga #${id.slice(0, 8)}: ${report.description.slice(0, 100)}`;
      await sql`INSERT INTO notifications(user_id,region_id,title,created_at)
        SELECT u.id,${regionId}::uuid,${title},${latestAt.toISOString()}::timestamptz
        FROM users u LEFT JOIN memberships m ON m.user_id=u.id
        LEFT JOIN notification_preferences p ON p.user_id=u.id
        WHERE NOT u.suspended AND COALESCE(p.enabled,true)
          AND (u.role='admin' OR m.region_id=${regionId}::uuid)
        ON CONFLICT DO NOTHING`.execute(tx);
    }
  });
}
