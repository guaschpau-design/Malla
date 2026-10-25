// Builds the HTTP application. Kept separate from main.ts so tests can run it in memory.

import fastifyWebsocket from '@fastify/websocket';
import { PROTOCOL_VERSION, RELAY_PATH } from '@malla/protocol';
import Fastify, { type FastifyInstance } from 'fastify';
import type WebSocket from 'ws';

import type { Relay } from './relay.ts';

/** Largest frame accepted: a push of the largest envelope is about 320 bytes of JSON. */
const MAX_FRAME_BYTES = 1024;
/** Connections that do not answer a ping within this time are closed. */
const HEARTBEAT_MS = 30_000;

export async function buildApp(relay: Relay): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket, { options: { maxPayload: MAX_FRAME_BYTES } });

  app.get('/healthz', () => ({ status: 'ok', protocolVersion: PROTOCOL_VERSION }));

  const alive = new WeakSet<WebSocket>();
  app.get(`/${RELAY_PATH}`, { websocket: true }, (socket) => {
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));
    relay.accept(socket);
  });

  const heartbeat = setInterval(() => {
    for (const socket of app.websocketServer.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, HEARTBEAT_MS);
  app.addHook('onClose', () => {
    clearInterval(heartbeat);
  });

  return app;
}
