import 'reflect-metadata';
import { setupAiCheckpoints } from '../packages/backend/dist/index.js';
await setupAiCheckpoints();
console.info('AI checkpoint schema migrated.');
