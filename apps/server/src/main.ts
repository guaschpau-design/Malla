import { buildApp } from './app.ts';
import { readConfig } from './config.ts';

const config = readConfig();
const app = buildApp();

try {
  await app.listen({ host: config.host, port: config.port });
  console.warn(`Malla server listening on ${config.host}:${config.port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
