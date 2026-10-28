// The relay over real WebSockets, with the server listening on a random local port.

import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { DEFAULT_LIMITS } from './relay-limits.ts';
import { Relay, type RelayOptions } from './relay.ts';
import { TestClient as Client } from './test-client.ts';

const GROUP = new Uint8Array(16).fill(7);
const OTHER_GROUP = new Uint8Array(16).fill(8);
/** A distinct key and envelope for every n. */
const key = (n: number) => numbered(16, n);
const env = (n: number) => numbered(60, n);

function numbered(size: number, n: number): Uint8Array {
  const bytes = new Uint8Array(size);
  new DataView(bytes.buffer).setUint32(0, n);
  return bytes;
}

/** Reads a client's backlog up to synced; returns the cursors it was sent. */
async function untilSynced(client: Client): Promise<number[]> {
  const cursors: number[] = [];
  for (;;) {
    const message = await client.next(10_000);
    if (message.t === 'synced') return cursors;
    if (message.t === 'env') cursors.push(message.cursor);
  }
}

let app: FastifyInstance | null = null;
const clients: Client[] = [];

interface Server {
  readonly store: EnvelopeStore;
  readonly connect: () => Promise<Client>;
  readonly join: (after?: number, group?: Uint8Array) => Promise<Client>;
}

async function start(options: RelayOptions = {}): Promise<Server> {
  const store = new EnvelopeStore(':memory:');
  app = await buildApp(store, new Relay(store, options));
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const url = `${address.replace('http', 'ws')}/v1/ws`;
  const connect = async () => {
    const client = await Client.connect(url);
    clients.push(client);
    return client;
  };
  const join = async (after = 0, group: Uint8Array = GROUP) => {
    const client = await connect();
    client.send({ t: 'join', group, after });
    return client;
  };
  return { store, connect, join };
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await app?.close();
  app = null;
  vi.restoreAllMocks();
});

describe('relay', () => {
  it('stores a push and relays it to the other members of the group only', async () => {
    const { store, join } = await start();
    const alice = await join();
    const bob = await join();
    const stranger = await join(0, OTHER_GROUP);
    for (const client of [alice, bob, stranger]) {
      expect(await client.next()).toEqual({ t: 'synced', cursor: 0, store: store.id });
    }

    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });
    expect(await alice.isQuiet()).toBe(true);
    expect(await stranger.isQuiet()).toBe(true);
  });

  it('answers a ping, before and after joining, so clients can tell a dead link', async () => {
    const { connect } = await start();
    const client = await connect();
    client.send({ t: 'ping' });
    expect(await client.next()).toEqual({ t: 'pong' });
    client.send({ t: 'join', group: GROUP, after: 0 });
    await client.next();
    client.send({ t: 'ping' });
    expect(await client.next()).toEqual({ t: 'pong' });
  });

  it('acknowledges a repeated push without relaying it again', async () => {
    const { join } = await start();
    const alice = await join();
    const bob = await join();
    await alice.next();
    await bob.next();

    alice.send({ t: 'push', key: key(1), env: env(1) });
    await alice.next();
    await bob.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.isQuiet()).toBe(true);
  });

  it('stores and relays a different envelope pushed under a known key', async () => {
    const { join } = await start();
    const mallory = await join();
    const bob = await join();
    await mallory.next();
    await bob.next();

    mallory.send({ t: 'push', key: key(1), env: env(66) });
    await mallory.next();
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(66) });
    const alice = await join();
    await untilSynced(alice);
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 2, key: key(1), env: env(1) });
  });

  it('sends a late joiner the backlog after its cursor, then synced', async () => {
    const { store, join } = await start();
    const alice = await join();
    await alice.next();
    for (let n = 1; n <= 3; n++) {
      alice.send({ t: 'push', key: key(n), env: env(n) });
      await alice.next();
    }

    const bob = await join(1);
    expect(await bob.next()).toEqual({ t: 'env', cursor: 2, key: key(2), env: env(2) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 3, key: key(3), env: env(3) });
    expect(await bob.next()).toEqual({ t: 'synced', cursor: 3, store: store.id });
  });

  it('sends everything to a client that remembers a cursor the server never reached', async () => {
    const { store, join } = await start();
    const alice = await join();
    await alice.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    await alice.next();

    const bob = await join(50);
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });
    expect(await bob.next()).toEqual({ t: 'synced', cursor: 1, store: store.id });
  });

  it('sends a long backlog a page at a time to a slow reader, losing nothing stored meanwhile', async () => {
    const { store, join } = await start();
    const backlog = 60_000;
    for (let n = 1; n <= backlog; n++) store.append(GROUP, key(n), env(n), 0);

    const slow = await join();
    slow.pause();
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Only about a page waits in the server's memory, not the whole backlog.
    for (const socket of app?.websocketServer.clients ?? []) {
      expect(socket.bufferedAmount).toBeLessThan(1024 * 1024);
    }
    // The server keeps serving others meanwhile, and what they store reaches the slow reader.
    const alice = await join(backlog);
    await alice.next();
    alice.send({ t: 'push', key: key(backlog + 1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(backlog + 1) });

    slow.resume();
    const cursors = await untilSynced(slow);
    expect(cursors).toEqual(Array.from({ length: backlog + 1 }, (_, i) => i + 1));
    alice.send({ t: 'push', key: key(backlog + 2), env: env(2) });
    expect(await slow.next()).toMatchObject({ t: 'env', cursor: backlog + 2 });
  }, 60_000);

  it('refuses pushes before joining and a second join', async () => {
    const { connect } = await start();
    const client = await connect();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'not-joined', key: key(1) });
    client.send({ t: 'join', group: GROUP, after: 0 });
    await client.next();
    client.send({ t: 'join', group: OTHER_GROUP, after: 0 });
    expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
  });

  it('answers malformed and oversized frames with an error instead of closing', async () => {
    const { join } = await start();
    const client = await join();
    await client.next();
    client.sendRaw('{"t":"push"}');
    expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
    client.send({ t: 'push', key: key(1), env: new Uint8Array(194) });
    expect(await client.next()).toEqual({ t: 'error', code: 'too-large', key: key(1) });
  });
});

describe('relay failures', () => {
  it('answers unavailable when the store cannot take a push, and keeps serving', async () => {
    const { store, join } = await start();
    const client = await join();
    await client.next();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const append = vi.spyOn(store, 'append').mockImplementationOnce(() => {
      throw new Error('database or disk is full');
    });
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'unavailable', key: key(1) });
    expect(error).toHaveBeenCalled();
    append.mockRestore();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(1) });
  });

  it('answers unavailable while the disk is nearly full', async () => {
    const { join } = await start({ hasRoom: () => false });
    const client = await join();
    await client.next();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'unavailable', key: key(1) });
  });

  it('closes a connection whose backlog cannot be read', async () => {
    const { store, join } = await start();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(store, 'after').mockImplementation(() => {
      throw new Error('disk I/O error');
    });
    const client = await join();
    expect(await client.closed()).toBe(1011);
  });
});

describe('relay limits', () => {
  it('rate-limits a connection that pushes too fast', async () => {
    const { join } = await start({ limits: { ...DEFAULT_LIMITS, connectionPerSecond: 0.2 } });
    const client = await join();
    await client.next();
    for (let n = 1; n <= 3; n++) client.send({ t: 'push', key: key(n), env: env(n) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(2) });
    expect(await client.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(3) });
  });

  it('rate-limits a group as a whole, across its connections and after they leave', async () => {
    const { join } = await start({ limits: { ...DEFAULT_LIMITS, groupPerSecond: 0.2 } });
    const alice = await join();
    const bob = await join();
    await alice.next();
    await bob.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    await bob.next();
    bob.send({ t: 'push', key: key(2), env: env(2) });
    expect(await bob.next()).toEqual({ t: 'stored', key: key(2) });
    await alice.next();
    alice.close();
    bob.close();

    const carol = await join();
    await untilSynced(carol);
    carol.send({ t: 'push', key: key(3), env: env(3) });
    expect(await carol.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(3) });
  });

  it('rate-limits pushes to the whole server', async () => {
    const { join } = await start({ limits: { ...DEFAULT_LIMITS, serverPerSecond: 0.1 } });
    const alice = await join();
    const stranger = await join(0, OTHER_GROUP);
    await alice.next();
    await stranger.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    stranger.send({ t: 'push', key: key(2), env: env(2) });
    expect(await stranger.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(2) });
  });

  it('refuses connections beyond its limit, in all and per address', async () => {
    const total = await start({ limits: { ...DEFAULT_LIMITS, maxConnections: 2 } });
    await total.connect();
    await total.connect();
    await expect(total.connect()).rejects.toThrow(/503/);
    for (const client of clients.splice(0)) client.close();
    await app?.close();

    const perAddress = await start({ limits: { ...DEFAULT_LIMITS, maxConnectionsPerAddress: 1 } });
    const first = await perAddress.connect();
    await expect(perAddress.connect()).rejects.toThrow(/503/);
    first.close();
    await first.closed();
    await expect
      .poll(() =>
        perAddress.connect().then(
          () => true,
          () => false,
        ),
      )
      .toBe(true);
  });

  it('counts the address a trusted proxy names, not the proxy', async () => {
    const store = new EnvelopeStore(':memory:');
    const limits = { ...DEFAULT_LIMITS, maxConnectionsPerAddress: 1 };
    app = await buildApp(store, new Relay(store, { limits }), {
      webRoot: null,
      upstream: null,
      commandPost: null,
      weather: null,
      trustedProxies: ['loopback'],
    });
    const url = `${(await app.listen({ host: '127.0.0.1', port: 0 })).replace('http', 'ws')}/v1/ws`;
    const from = async (address: string) => {
      const client = await Client.connect(url, { 'X-Forwarded-For': address });
      clients.push(client);
    };
    await from('192.0.2.1');
    await from('192.0.2.2');
    await expect(from('192.0.2.1')).rejects.toThrow(/503/);
  });

  it('closes a connection that does not join in time', async () => {
    const { connect } = await start({ limits: { ...DEFAULT_LIMITS, joinTimeoutMs: 100 } });
    const client = await connect();
    expect(await client.closed()).toBe(1008);
  });

  it('limits the new groups one address may open, but not joining known ones', async () => {
    const { join } = await start({
      limits: { ...DEFAULT_LIMITS, newGroupsPerAddressPerHour: 1 },
    });
    const first = await join(0, GROUP);
    await first.next();
    const known = await join(0, GROUP);
    expect(await known.next()).toMatchObject({ t: 'synced' });
    const another = await join(0, OTHER_GROUP);
    expect(await another.next()).toEqual({ t: 'error', code: 'rate-limited', key: null });
    expect(await another.closed()).toBe(1013);
  });
});
