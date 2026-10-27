// A command post replicating its upstream, both running on random local ports.

import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';
import { Replicator } from './replicator.ts';
import { TestClient } from './test-client.ts';

const GROUP = new Uint8Array(16).fill(7);
const OTHER_GROUP = new Uint8Array(16).fill(9);
const key = (n: number) => new Uint8Array(16).fill(n);
const env = (n: number) => new Uint8Array(60).fill(n);

interface Server {
  readonly app: FastifyInstance;
  readonly store: EnvelopeStore;
  readonly relay: Relay;
  readonly url: string;
}

const cleanup: (() => Promise<void> | void)[] = [];

async function server(port = 0, upstream = false): Promise<Server> {
  const store = new EnvelopeStore(':memory:', { upstream });
  const relay = new Relay(store);
  const app = await buildApp(store, relay);
  const url = await app.listen({ host: '127.0.0.1', port });
  cleanup.push(() => app.close());
  return { app, store, relay, url };
}

function replicate(post: Server, upstream: string, maxLinks = 100): void {
  const replicator = new Replicator({ store: post.store, relay: post.relay, upstream, maxLinks });
  replicator.start();
  cleanup.unshift(() => {
    replicator.stop();
  });
}

async function member(server: string, after = 0, group = GROUP): Promise<TestClient> {
  const client = await TestClient.connect(`${server.replace('http', 'ws')}/v1/ws`);
  cleanup.unshift(() => {
    client.close();
  });
  client.send({ t: 'join', group, after });
  return client;
}

/** A port that nothing listens on, until a server is started on it. */
async function closedPort(): Promise<number> {
  const reserved = await server();
  await reserved.app.close();
  return Number(new URL(reserved.url).port);
}

afterEach(async () => {
  for (const step of cleanup.splice(0)) await step();
  vi.restoreAllMocks();
});

describe('replicator', () => {
  it('carries envelopes both ways between a command post and its upstream', async () => {
    const upstream = await server();
    const post = await server(0, true);
    replicate(post, upstream.url);

    const atPost = await member(post.url);
    const online = await member(upstream.url);
    expect(await atPost.next()).toEqual({ t: 'synced', cursor: 0, store: post.store.id });
    expect(await online.next()).toEqual({ t: 'synced', cursor: 0, store: upstream.store.id });

    atPost.send({ t: 'push', key: key(1), env: env(1) });
    expect(await atPost.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await online.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });

    online.send({ t: 'push', key: key(2), env: env(2) });
    expect(await online.next()).toEqual({ t: 'stored', key: key(2) });
    expect(await atPost.next()).toEqual({ t: 'env', cursor: 2, key: key(2), env: env(2) });

    // Nothing travels back to where it came from.
    expect(await online.isQuiet()).toBe(true);
    expect(upstream.store.lastCursor(GROUP)).toBe(2);
    expect(post.store.nextPendingUpstream(GROUP)).toBeNull();
    expect(post.store.upstreamStore(GROUP)).toBe(upstream.store.id);
  });

  it('delivers what the post gathered once the upstream can be reached', async () => {
    const port = await closedPort();
    const post = await server(0, true);
    replicate(post, `http://127.0.0.1:${String(port)}`);
    const atPost = await member(post.url);
    await atPost.next();
    for (const n of [1, 2]) {
      atPost.send({ t: 'push', key: key(n), env: env(n) });
      await atPost.next();
    }

    const upstream = await server(port);
    const online = await member(upstream.url);
    const received = [await online.next(), await online.next(5000), await online.next()];
    expect(received).toContainEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });
    expect(received).toContainEqual({ t: 'env', cursor: 2, key: key(2), env: env(2) });
  });

  it('picks up groups stored before it started', async () => {
    const upstream = await server();
    const post = await server(0, true);
    post.store.append(GROUP, key(1), env(1), Date.now());
    replicate(post, upstream.url);

    const online = await member(upstream.url);
    const first = await online.next();
    const second = first.t === 'synced' ? await online.next() : first;
    expect(second).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });
  });

  it('keeps a link only while the group has clients at the post or envelopes to upload', async () => {
    const upstream = await server();
    const post = await server(0, true);
    replicate(post, upstream.url);
    expect(upstream.relay.clientsIn(GROUP)).toBe(0);

    const atPost = await member(post.url);
    await atPost.next();
    await expect.poll(() => upstream.relay.clientsIn(GROUP)).toBe(1);
    atPost.close();
    await expect.poll(() => upstream.relay.clientsIn(GROUP)).toBe(0);
  });

  it('gives its links to the groups active most recently', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const upstream = await server();
    const post = await server(0, true);
    replicate(post, upstream.url, 1);

    await (await member(post.url, 0, GROUP)).next();
    await expect.poll(() => upstream.relay.clientsIn(GROUP)).toBe(1);
    const other = await member(post.url, 0, OTHER_GROUP);
    await other.next();
    await expect.poll(() => upstream.relay.clientsIn(OTHER_GROUP)).toBe(1);
    expect(upstream.relay.clientsIn(GROUP)).toBe(0);

    // The freed link goes back to the group still in use.
    other.close();
    await expect.poll(() => upstream.relay.clientsIn(GROUP)).toBe(1);
    expect(upstream.relay.clientsIn(OTHER_GROUP)).toBe(0);
  });

  it('gives a replaced upstream everything it holds, and reads it from the start', async () => {
    const port = await closedPort();
    const first = await server(port);
    const post = await server(0, true);
    replicate(post, `http://127.0.0.1:${String(port)}`);
    const atPost = await member(post.url);
    await atPost.next();
    atPost.send({ t: 'push', key: key(1), env: env(1) });
    await atPost.next();
    const online = await member(first.url);
    await online.next();
    online.send({ t: 'push', key: key(2), env: env(2) });
    await online.next();
    await expect.poll(() => post.store.lastCursor(GROUP)).toBe(2);
    await expect.poll(() => first.store.lastCursor(GROUP)).toBe(2);

    // The upstream comes back from a backup that has neither envelope.
    online.close();
    await first.app.close();
    const replaced = await server(port);
    replaced.store.append(GROUP, key(3), env(3), Date.now());
    await expect.poll(() => replaced.store.lastCursor(GROUP), { timeout: 10_000 }).toBe(3);
    expect(post.store.upstreamStore(GROUP)).toBe(replaced.store.id);
    expect(post.store.lastCursor(GROUP)).toBe(3);
  });

  it('drops an upstream that sends frames larger than the protocol allows', async () => {
    const closes: number[] = [];
    const rogue = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    cleanup.push(
      () =>
        new Promise<void>((resolve) => {
          rogue.close(() => {
            resolve();
          });
        }),
    );
    rogue.on('connection', (socket) => {
      socket.on('message', () => {
        socket.send('x'.repeat(4096));
      });
      socket.on('close', (code) => {
        closes.push(code);
      });
    });
    await new Promise((resolve) => rogue.once('listening', resolve));
    const { port } = rogue.address() as { port: number };

    const post = await server(0, true);
    replicate(post, `http://127.0.0.1:${String(port)}`);
    await (await member(post.url)).next();
    await expect.poll(() => closes).toContain(1009);
  });
});
