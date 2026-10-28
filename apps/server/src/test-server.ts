// A Tesel server for tests: its database in memory, and the options of a server with no web root,
// upstream, command post, weather or proxies, but for those a test sets.

import type { FastifyInstance } from 'fastify';

import { buildApp, NO_OPTIONS, type AppOptions } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay, type RelayOptions } from './relay.ts';

export interface TestServer {
  readonly store: EnvelopeStore;
  readonly relay: Relay;
  readonly app: FastifyInstance;
}

export async function testServer({
  app = {},
  relay = {},
  upstream = false,
}: {
  readonly app?: Partial<AppOptions>;
  readonly relay?: RelayOptions;
  /** Whether it is a command post, which keeps what its upstream still lacks. */
  readonly upstream?: boolean;
} = {}): Promise<TestServer> {
  const store = new EnvelopeStore(':memory:', { upstream });
  const relayOfStore = new Relay(store, relay);
  return {
    store,
    relay: relayOfStore,
    app: await buildApp(store, relayOfStore, { ...NO_OPTIONS, ...app }),
  };
}

/** Starts listening on a local port, any free one by default; resolves to the server's URL. */
export function listen(server: TestServer, port = 0): Promise<string> {
  return server.app.listen({ host: '127.0.0.1', port });
}
