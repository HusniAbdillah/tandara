import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/backend/package.json', import.meta.url));
const databaseRequire = createRequire(
  new URL('../packages/database/package.json', import.meta.url),
);
const { Client } = databaseRequire('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// This task exports identifiers only. Never put report text, contacts or model context in it.
const { APP_MODE, DATABASE_URL, PRIVACY_LEDGER_BUCKET, PRIVACY_LEDGER_KMS_KEY, AWS_REGION } =
  process.env;
let db;
let s3;
try {
  if (APP_MODE !== 'production') throw new Error('Production-only backup task.');
  const url = new URL(DATABASE_URL);
  if (url.searchParams.get('sslmode') !== 'verify-full' || !url.searchParams.get('sslrootcert'))
    throw new Error('Verified database TLS required.');
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(PRIVACY_LEDGER_BUCKET ?? '') ||
    !/^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[a-f0-9-]+$/.test(PRIVACY_LEDGER_KMS_KEY ?? '') ||
    !/^[a-z]{2}-[a-z]+-\d$/.test(AWS_REGION ?? '')
  )
    throw new Error('Reviewed bucket, KMS key and AWS region required.');
  db = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
  });
  await db.connect();
  // A session lock also covers the upload: overlapping scheduled tasks cannot replace a newer snapshot.
  const lock = await db.query(
    "SELECT pg_try_advisory_lock(hashtextextended('privacy-ledger-export',0)) AS acquired",
  );
  if (!lock.rows[0].acquired) {
    console.info('Privacy ledger export already running.');
  } else {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const ledger = {
      exportedAt: new Date().toISOString(),
      erasedReports: (
        await db.query('SELECT report_id FROM erasure_ledger ORDER BY report_id')
      ).rows.map((r) => r.report_id),
      withdrawnReferences: (
        await db.query("SELECT id FROM knowledge_references WHERE state='withdrawn' ORDER BY id")
      ).rows.map((r) => r.id),
    };
    const body = JSON.stringify(ledger);
    if (Buffer.byteLength(body) > 10 * 1024 * 1024)
      throw new Error('Ledger capacity requires operational review.');
    s3 = new S3Client({
      region: AWS_REGION,
      endpoint: `https://s3.${AWS_REGION}.amazonaws.com`,
      maxAttempts: 2,
    });
    const result = await s3.send(
      new PutObjectCommand({
        Bucket: PRIVACY_LEDGER_BUCKET,
        Key: 'privacy/ledger/latest.json',
        Body: body,
        ContentType: 'application/json',
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: PRIVACY_LEDGER_KMS_KEY,
        ChecksumAlgorithm: 'SHA256',
      }),
      { abortSignal: AbortSignal.timeout(20000) },
    );
    if (!result.VersionId) throw new Error('Versioned backup required.');
    await db.query('COMMIT');
    console.info('Privacy ledger backup completed.');
  }
} catch {
  // Driver/SDK errors can include credentials or network details. Keep shared logs content-free.
  console.error(
    'Privacy ledger backup failed. Check private task configuration and backup alarms.',
  );
  process.exitCode = 1;
} finally {
  s3?.destroy();
  await db?.end().catch(() => {});
}
