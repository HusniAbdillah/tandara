import 'reflect-metadata';
import { createAiAdapter } from '../packages/backend/dist/index.js';

// An explicit operator command: one synthetic, potentially billable inference call.
try {
  if (process.env.AI_MODE !== 'compatible')
    throw new Error('Set AI_MODE=compatible and replace AI_MODEL/AI_API_KEY before verification.');
  const adapter = createAiAdapter();
  if (!adapter) throw new Error('Model inference is disabled.');
  const started = Date.now();
  const output = await adapter.suggest({
    id: '40000000-0000-4000-8000-000000000099',
    description:
      'SIMULASI PENGUJIAN: terlihat genangan di jalan dekat balai latihan. Bukan kejadian nyata.',
    landmarkText: 'Balai latihan',
    observationTime: null,
  });
  console.info(
    JSON.stringify({
      valid: true,
      provider: adapter.provider,
      model: adapter.model,
      needsHumanReview: output.needsHumanReview,
      durationMs: Date.now() - started,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'AI verification failed.');
  process.exitCode = 1;
}
