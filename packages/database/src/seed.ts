import { randomBytes, scryptSync } from 'node:crypto';
import { sql } from 'kysely';
import { createDatabase } from './client.js';
import { seedWorkflow, seedResidentReports } from './seed-workflow.js';
import { seedDemoAccounts } from './demo-accounts.js';
import { seedDemoResident } from './demo-resident.js';

if (process.env['APP_MODE'] !== 'simulation')
  throw new Error('Seed allowed only in explicit simulation mode.');
const password = process.env['DEMO_PASSWORD'];
if (!password || password.length < 12)
  throw new Error('Set DEMO_PASSWORD to at least 12 characters.');
const connection = process.env['DATABASE_URL'];
if (!connection) throw new Error('DATABASE_URL required');
const { db } = createDatabase(connection);
const ids = {
  org1: '10000000-0000-4000-8000-000000000001',
  org2: '10000000-0000-4000-8000-000000000002',
  region1: '20000000-0000-4000-8000-000000000001',
  region2: '20000000-0000-4000-8000-000000000002',
  user1: '30000000-0000-4000-8000-000000000001',
  user2: '30000000-0000-4000-8000-000000000002',
  admin: '30000000-0000-4000-8000-000000000003',
};
const now = new Date();
try {
  await db.transaction().execute(async (tx) => {
    // Repeatable seed never overwrites operational changes or passwords.
    for (const [id, name] of [
      [ids.org1, 'Komunitas Siaga Ciliwung (simulasi)'],
      [ids.org2, 'Forum Warga Semarang (simulasi)'],
    ]) {
      await sql`INSERT INTO organizations(id,name,description) VALUES (${id}::uuid,${name},'Organisasi fiktif untuk demonstrasi') ON CONFLICT DO NOTHING`.execute(
        tx,
      );
    }
    for (const [id, org, name, lon, lat] of [
      [ids.region1, ids.org1, 'Kampung Ciliwung', 106.861, -6.217],
      [ids.region2, ids.org2, 'Pesisir Semarang', 110.42, -6.963],
    ] as const) {
      const config = {
        categories: [
          'road_flooding',
          'water_entering_homes',
          'blocked_access',
          'follow_up_needed',
          'other',
        ],
        coverageHours: id === ids.region1 ? 6 : 12,
        retentionDays: 30,
        contacts: [],
        languages: ['id'],
      };
      await sql`INSERT INTO regions(id,organization_id,name,boundary,config) VALUES(${id}::uuid,${org}::uuid,${name},ST_MakeEnvelope(${lon - 0.02},${lat - 0.02},${lon + 0.02},${lat + 0.02},4326),${JSON.stringify(config)}::jsonb) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
    }
    for (const [id, email, name, role] of [
      [ids.user1, 'ciliwung@demo.tandara.test', 'Koordinator Ciliwung', 'coordinator'],
      [ids.user2, 'semarang@demo.tandara.test', 'Koordinator Semarang', 'coordinator'],
      [ids.admin, 'admin@demo.tandara.test', 'Administrator Demo', 'admin'],
    ] as const) {
      const salt = randomBytes(16).toString('hex');
      const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
      await sql`INSERT INTO users(id,email,name,role,password_hash) VALUES(${id}::uuid,${email},${name},${role},${hash}) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
    }
    for (const [user, region, org] of [
      [ids.user1, ids.region1, ids.org1],
      [ids.user2, ids.region2, ids.org2],
    ]) {
      await sql`INSERT INTO memberships VALUES(${user}::uuid,${region}::uuid,${org}::uuid) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
    }
    for (const [region, author, lon, lat] of [
      [ids.region1, ids.user1, 106.861, -6.217],
      [ids.region2, ids.user2, 110.42, -6.963],
    ] as const) {
      const content = {
        title: 'Rencana kesiapsiagaan warga',
        instructions: [
          'Siapkan dokumen penting dalam kantong kedap air.',
          'Sepakati cara menghubungi anggota keluarga saat koneksi terganggu.',
          'Periksa informasi dari kanal otoritas resmi sebelum mengambil keputusan.',
          'Titik pertemuan contoh ini hanya untuk latihan; kesesuaian lokasi harus diperiksa kembali.',
        ],
        points: [
          {
            name: 'Balai warga latihan',
            description:
              'Lokasi fiktif. Temui pengelola lokal untuk informasi akses dan kondisi terbaru.',
            latitude: lat + 0.004,
            longitude: lon + 0.004,
            accessibility: 'Contoh akses tanpa tangga; perlu pemeriksaan langsung.',
          },
        ],
        routes: [],
        checklist: [
          'Siapkan air minum dan kebutuhan dasar',
          'Simpan dokumen penting',
          'Sepakati kontak keluarga',
          'Baca rencana lokal',
          'Periksa kebutuhan anggota keluarga',
        ],
        expiresAt: new Date(now.getTime() + 90 * 86400000).toISOString(),
      };
      await sql`INSERT INTO plan_versions(region_id,version,content,state,author_id,reviewer_id,reviewed_at,review_note) VALUES(${region}::uuid,1,${JSON.stringify(content)}::jsonb,'published',${author}::uuid,${ids.admin}::uuid,now(),'Peninjauan simulasi oleh administrator demo') ON CONFLICT DO NOTHING`.execute(
        tx,
      );
      await sql`INSERT INTO plan_versions(region_id,version,content,state,author_id) VALUES(${region}::uuid,2,${JSON.stringify({ ...content, title: 'Draf pembaruan rencana warga' })}::jsonb,'in_review',${author}::uuid) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
      const seededReferences = [
        [
          region === ids.region1
            ? '51000000-0000-4000-8000-000000000001'
            : '52000000-0000-4000-8000-000000000001',
          'Panduan Evakuasi Mandiri, Kelompok Rentan, dan Titik Kumpul (Simulasi)',
          'Keluarga perlu menyiapkan tas siaga 72 jam berisi dokumen penting dalam kantong kedap air, obat rutin pribadi, air minum, senter, dan pakaian ganti sebelum musim hujan puncak.\n\nPrioritaskan pendampingan bagi kelompok rentan seperti lansia, balita, ibu hamil, dan penyandang disabilitas saat menuju titik kumpul sementara di balai warga atau sekolah yang telah ditinjau koordinator.',
          'https://example.org/tandara/sop-evakuasi-simulasi',
          'Referensi simulasi latihan komunitas Tandara; ditinjau independen oleh koordinator dan admin.',
        ],
        [
          region === ids.region1
            ? '51000000-0000-4000-8000-000000000002'
            : '52000000-0000-4000-8000-000000000002',
          'SOP Triase Laporan Warga, Verifikasi Silang, dan Komunikasi Publik Posko (Simulasi)',
          'Setiap laporan warga diperlakukan sebagai observasi awal yang memerlukan tinjauan manusia di Posko dan verifikasi silang terhadap pengamatan tinggi muka air serta kanal resmi BMKG atau BPBD.\n\nApabila patokan lokasi, waktu pengamatan, atau dampak genangan belum jelas, koordinator meminta klarifikasi secara sopan kepada pelapor sebelum menerbitkan ringkasan publik yang tenang dan faktual.',
          'https://example.org/tandara/sop-triase-posko-simulasi',
          'Pedoman internal simulasi operasional Posko Tandara untuk tata kelola komunikasi warga.',
        ],
        [
          region === ids.region1
            ? '51000000-0000-4000-8000-000000000003'
            : '52000000-0000-4000-8000-000000000003',
          'Protokol Keselamatan Listrik, Drainase Lingkungan, dan Pascabanjir (Simulasi)',
          'Segera matikan panel listrik utama rumah apabila air mulai memasuki teras atau lantai dasar, dan hindari berjalan maupun berkendara melewati genangan berarus atau saluran terbuka.\n\nPembersihan sumbatan sampah atau ranting pada drainase lingkungan dilakukan secara berkelompok dengan alat pelindung dasar serta dilaporkan kemajuannya ke Posko untuk pembaruan status penanganan.',
          'https://example.org/tandara/sop-keselamatan-drainase-simulasi',
          'Panduan keselamatan lingkungan simulasi komunitas; bukan pengganti instruksi darurat resmi.',
        ],
      ] as const;
      for (const [refId, refTitle, refText, refUrl, refLicense] of seededReferences) {
        await sql`INSERT INTO knowledge_references(id,region_id,version,title,text,source_url,license_note,expires_at,state,author_id,reviewer_id,review_note) VALUES(${refId}::uuid,${region}::uuid,1,${refTitle},${refText},${refUrl},${refLicense},${new Date(now.getTime() + 90 * 86400000).toISOString()}::timestamptz,'approved',${author}::uuid,${ids.admin}::uuid,'Disetujui secara independen untuk pustaka pengetahuan RAG wilayah.') ON CONFLICT DO NOTHING`.execute(
          tx,
        );
      }
      for (const [provider, name, enabled, mode, url, note] of [
        [
          'fixture',
          'Pusat informasi latihan',
          true,
          'simulation',
          'https://example.org/tandara/simulation',
          'Fixture sintetis; bukan sumber resmi.',
        ],
        [
          'bmkg',
          'BMKG — prakiraan cuaca',
          false,
          'disabled',
          'https://data.bmkg.go.id/prakiraan-cuaca/',
          'Atribusi BMKG wajib; 60 permintaan/menit/IP. Prakiraan cuaca bukan peringatan banjir.',
        ],
        [
          'petabencana',
          'PetaBencana — laporan urun daya',
          false,
          'disabled',
          'https://docs.petabencana.id/routes/laporan-urun-daya',
          'Periksa izin penggunaan dan lisensi sebelum aktivasi; laporan urun daya bukan peringatan resmi.',
        ],
        [
          'inarisk',
          'InaRISK — konteks risiko',
          false,
          'disabled',
          'https://inarisk.bnpb.go.id',
          'Belum tersedia konektor berizin; tautan referensi saja.',
        ],
      ] as const) {
        const exists =
          await sql`SELECT id FROM information_sources WHERE region_id=${region}::uuid AND provider=${provider}`.execute(
            tx,
          );
        if (!exists.rows.length)
          await sql`INSERT INTO information_sources(region_id,name,provider,enabled,mode,source_url,license_note,config) VALUES(${region}::uuid,${name},${provider},${enabled},${mode},${url},${note},${JSON.stringify({ adm4: '31.71.03.1001', admin: 'ID-JK', authorized: false })}::jsonb)`.execute(
            tx,
          );
      }
      const source = await sql<{
        id: string;
      }>`SELECT id FROM information_sources WHERE region_id=${region}::uuid AND provider='fixture'`.execute(
        tx,
      );
      await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('source_sync',${source.rows[0]!.id}::uuid,${region}::uuid,${`seed-source-${region}`}) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
      const training = {
        title: 'Latihan memahami informasi',
        description: 'Simulasi singkat untuk membedakan sumber dan informasi yang belum ditinjau.',
        scheduledAt: null,
        steps: [
          {
            question: 'Sebuah laporan warga belum ditinjau. Bagaimana Anda membacanya?',
            options: ['Sebagai peringatan resmi', 'Sebagai observasi yang masih perlu diperiksa'],
            answer: 1,
            explanation: 'Laporan warga bukan peringatan resmi dan memerlukan tinjauan manusia.',
          },
          {
            question: 'Area tidak memiliki laporan terbaru. Apa artinya?',
            options: ['Area aman', 'Informasi belum cukup'],
            answer: 1,
            explanation: 'Tidak adanya laporan tidak membuktikan bahwa suatu wilayah aman.',
          },
          {
            question: 'Rencana tersimpan dibuka tanpa internet. Apa yang perlu diperiksa?',
            options: [
              'Tanggal versi dan informasi terbaru dari kanal resmi',
              'Tidak perlu memeriksa apa pun',
            ],
            answer: 0,
            explanation:
              'Rencana offline mungkin kedaluwarsa; aplikasi tidak menerima pembaruan saat offline.',
          },
        ],
      };
      const scenarioExists =
        await sql`SELECT id FROM training_scenarios WHERE region_id=${region}::uuid`.execute(tx);
      if (!scenarioExists.rows.length)
        await sql`INSERT INTO training_scenarios(region_id,content,author_id) VALUES(${region}::uuid,${JSON.stringify(training)}::jsonb,${author}::uuid)`.execute(
          tx,
        );
    }
    for (const [i, description, landmark, help, lon, lat] of [
      [
        1,
        'Terlihat genangan di jalan dekat pasar latihan sejak pagi.',
        'Pasar latihan sisi utara',
        false,
        106.86,
        -6.218,
      ],
      [
        2,
        'Air menggenang di ruas jalan depan pasar latihan.',
        'Pasar latihan pintu utara',
        false,
        106.8603,
        -6.2181,
      ],
      [3, 'Air mulai naik di dekat sana, lokasi belum dapat dipastikan.', '', false, null, null],
      [
        4,
        'Memerlukan tindak lanjut komunitas untuk kebutuhan dasar keluarga.',
        'Lokasi disampaikan kepada koordinator',
        true,
        106.866,
        -6.22,
      ],
    ] as const) {
      const id = `40000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      await sql`INSERT INTO reports(id,region_id,category,description,landmark_text,observation_time,location,follow_up_requested,tracking_hash,idempotency_key,payload_hash) VALUES(${id}::uuid,${ids.region1}::uuid,${help ? 'follow_up_needed' : 'road_flooding'},${description},${landmark},${now.toISOString()}::timestamptz,CASE WHEN ${lon}::float IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${lon},${lat}),4326) END,${help},${`seed-untrackable-${i}`},${id}::uuid,'seed') ON CONFLICT DO NOTHING`.execute(
        tx,
      );
      await sql`INSERT INTO outbox_jobs(kind,entity_id,region_id,dedupe_key) VALUES('triage',${id}::uuid,${ids.region1}::uuid,${`seed-triage-${i}`}) ON CONFLICT DO NOTHING`.execute(
        tx,
      );
      if (help) {
        await sql`INSERT INTO report_private_details(report_id,contact_details,consent_at,retention_until) VALUES(${id}::uuid,'Kontak fiktif: warga-demo (bukan nomor telepon)',now(),now()+interval '30 days') ON CONFLICT DO NOTHING`.execute(
          tx,
        );
        await sql`INSERT INTO assistance_requests(report_id,region_id) VALUES(${id}::uuid,${ids.region1}::uuid) ON CONFLICT DO NOTHING`.execute(
          tx,
        );
      }
    }
  });
  await seedDemoAccounts(db, password, process.env['DEMO_LOGIN_ENABLED'] === 'true');
  await seedDemoResident(db);
  await seedWorkflow(db);
  await seedResidentReports(db);
  console.info('Development seed complete. Existing records preserved.');
} finally {
  await db.destroy();
}
