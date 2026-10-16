const operation = process.argv[2];
if (!['migrate', 'seed', 'demo-seed'].includes(operation))
  throw new Error('Expected migrate, seed or demo-seed');
// Installed beside the deployed backend's package.json; no reliance on pnpm store names.
const database = import.meta.resolve('@tandara/database');
await import(new URL(`./${operation}.js`, database));
