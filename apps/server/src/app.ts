// Builds the HTTP application. Kept separate from main.ts so tests can run it in memory.

import fastifyWebsocket from '@fastify/websocket';
import { PROTOCOL_VERSION, RELAY_PATH, SERVER_INFO_PATH } from '@tesel/protocol';
import Fastify, { type FastifyInstance } from 'fastify';
import type WebSocket from 'ws';

import type { Relay } from './relay.ts';
import { serveWeb } from './web.ts';

/** Largest frame accepted: a push of the largest envelope is about 320 bytes of JSON. */
const MAX_FRAME_BYTES = 1024;
/** Connections that do not answer a ping within this time are closed. */
const HEARTBEAT_MS = 30_000;

export interface AppOptions {
  /** Directory to serve the landing page and the web app from, or null. */
  readonly webRoot: string | null;
  /** What `healthz` tells clients (protocol §8.1). */
  readonly upstream: string | null;
  readonly commandPost: string | null;
}

const NO_OPTIONS: AppOptions = { webRoot: null, upstream: null, commandPost: null };

export async function buildApp(
  relay: Relay,
  options: AppOptions = NO_OPTIONS,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket, { options: { maxPayload: MAX_FRAME_BYTES } });

  // Apps served from another origin read this too (protocol §8.3).
  app.get(`/${SERVER_INFO_PATH}`, (_request, reply) => {
    void reply.header('Access-Control-Allow-Origin', '*');
    return {
      status: 'ok',
      protocolVersion: PROTOCOL_VERSION,
      upstream: options.upstream,
      commandPost: options.commandPost,
    };
  });
  if (options.webRoot !== null) await serveWeb(app, options.webRoot);

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
