import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildApp } from './app.ts';
import { readConfig } from './config.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';
import { Replicator } from './replicator.ts';
import { WeatherWarningsService } from './weather/weather-warnings.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_SWEEP_MS = 60 * 60 * 1000;

const config = readConfig();
if (config.databasePath !== ':memory:')
  mkdirSync(dirname(config.databasePath), { recursive: true });
const store = new EnvelopeStore(config.databasePath, { upstream: config.upstream !== null });
const relay = new Relay(store, Date.now);
const weather =
  config.weatherCountries.length === 0
    ? null
    : new WeatherWarningsService({
        countries: config.weatherCountries,
        // The outlines are kept next to the database, so they survive the container.
        regionsFile:
          config.databasePath === ':memory:'
            ? null
            : join(dirname(config.databasePath), 'weather-regions.json'),
      });
weather?.start();
const app = await buildApp(relay, { ...config, weather });
const replicator =
  config.upstream === null ? null : new Replicator({ store, relay, upstream: config.upstream });
replicator?.start();

const sweep = () => store.deleteReceivedBefore(Date.now() - config.retentionDays * DAY_MS);
sweep();
const sweeper = setInterval(sweep, RETENTION_SWEEP_MS);

async function shutdown(): Promise<void> {
  clearInterval(sweeper);
  replicator?.stop();
  weather?.stop();
  await app.close();
  store.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

try {
  await app.listen({ host: config.host, port: config.port });
  console.warn(`Tesel server listening on ${config.host}:${config.port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
