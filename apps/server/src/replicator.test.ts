// A command post replicating its upstream, both running on random local ports.

import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';
import { Replicator } from './replicator.ts';
import { TestClient } from './test-client.ts';

const GROUP = new Uint8Array(16).fill(7);
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
  const relay = new Relay(store, Date.now);
  const app = await buildApp(relay);
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
    expect(await atPost.next()).toEqual({ t: 'synced', cursor: 0 });
    expect(await online.next()).toEqual({ t: 'synced', cursor: 0 });

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
  });

  it('delivers what the post gathered once the upstream can be reached', async () => {
    // Reserve a port, then leave it closed: the upstream is "offline".
    const reserved = await server();
    const port = Number(new URL(reserved.url).port);
    await reserved.app.close();

    const post = await server(0, true);
    replicate(post, `http://127.0.0.1:${port}`);
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

  it('opens a bounded number of upstream connections, whatever group IDs clients join', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const upstream = await server();
    const post = await server(0, true);
    replicate(post, upstream.url, 1);
    const other = new Uint8Array(16).fill(9);
    await (await member(post.url)).next();
    await (await member(post.url, 0, other)).next();

    const atPost = await member(post.url, 0, other);
    await atPost.next();
    atPost.send({ t: 'push', key: key(1), env: env(1) });
    await atPost.next();
    const online = await member(upstream.url, 0, other);
    expect(await online.next()).toEqual({ t: 'synced', cursor: 0 });
    expect(await online.isQuiet()).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});
