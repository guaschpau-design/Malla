import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { buildApp } from './app.ts';
import { readConfig } from './config.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_SWEEP_MS = 60 * 60 * 1000;

const config = readConfig();
if (config.databasePath !== ':memory:')
  mkdirSync(dirname(config.databasePath), { recursive: true });
const store = new EnvelopeStore(config.databasePath);
const app = await buildApp(new Relay(store, Date.now), { webRoot: config.webRoot });

const sweep = () => store.deleteReceivedBefore(Date.now() - config.retentionDays * DAY_MS);
sweep();
const sweeper = setInterval(sweep, RETENTION_SWEEP_MS);

async function shutdown(): Promise<void> {
  clearInterval(sweeper);
  await app.close();
  store.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

try {
  await app.listen({ host: config.host, port: config.port });
  console.warn(`Teselia server listening on ${config.host}:${config.port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
