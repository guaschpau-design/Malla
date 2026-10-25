// Builds the HTTP application. Kept separate from main.ts so tests can run it in memory.

import { PROTOCOL_VERSION } from '@malla/protocol';
import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/healthz', () => ({ status: 'ok', protocolVersion: PROTOCOL_VERSION }));

  return app;
}
