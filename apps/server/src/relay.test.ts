// The relay over real WebSockets, with the server listening on a random local port.

import {
  encodeRelayMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from '@malla/protocol';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { DEFAULT_LIMITS, Relay, type RelayLimits } from './relay.ts';

const GROUP = new Uint8Array(16).fill(7);
const OTHER_GROUP = new Uint8Array(16).fill(8);
const key = (n: number) => new Uint8Array(16).fill(n);
const env = (n: number) => new Uint8Array(60).fill(n);

/** A test client that queues every message the server sends. */
class Client {
  readonly #socket: WebSocket;
  readonly #queue: ServerMessage[] = [];
  #waiting: ((message: ServerMessage) => void) | null = null;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.on('message', (data) => {
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : '';
      const message = parseServerMessage(text);
      if (message === null) throw new Error(`unparseable frame ${text}`);
      if (this.#waiting) {
        this.#waiting(message);
        this.#waiting = null;
      } else {
        this.#queue.push(message);
      }
    });
  }

  static async connect(url: string): Promise<Client> {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return new Client(socket);
  }

  send(message: ClientMessage): void {
    this.#socket.send(encodeRelayMessage(message));
  }

  sendRaw(text: string): void {
    this.#socket.send(text);
  }

  next(): Promise<ServerMessage> {
    const queued = this.#queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('no message'));
      }, 2000);
      this.#waiting = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
    });
  }

  /** True if nothing arrives for a short while. */
  async isQuiet(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.#queue.length === 0;
  }

  close(): void {
    this.#socket.close();
  }
}

let app: FastifyInstance | null = null;
const clients: Client[] = [];

async function start(limits: RelayLimits = DEFAULT_LIMITS): Promise<() => Promise<Client>> {
  app = await buildApp(new Relay(new EnvelopeStore(':memory:'), Date.now, limits));
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const url = `${address.replace('http', 'ws')}/v1/ws`;
  return async () => {
    const client = await Client.connect(url);
    clients.push(client);
    return client;
  };
}

async function joined(connect: () => Promise<Client>, after = 0): Promise<Client> {
  const client = await connect();
  client.send({ t: 'join', group: GROUP, after });
  return client;
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await app?.close();
  app = null;
});

describe('relay', () => {
  it('stores a push and relays it to the other members of the group only', async () => {
    const connect = await start();
    const alice = await joined(connect);
    const bob = await joined(connect);
    const stranger = await connect();
    stranger.send({ t: 'join', group: OTHER_GROUP, after: 0 });
    for (const client of [alice, bob, stranger]) {
      expect(await client.next()).toEqual({ t: 'synced', cursor: 0 });
    }

    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, env: env(1) });
    expect(await alice.isQuiet()).toBe(true);
    expect(await stranger.isQuiet()).toBe(true);
  });

  it('acknowledges a repeated push without relaying it again', async () => {
    const connect = await start();
    const alice = await joined(connect);
    const bob = await joined(connect);
    await alice.next();
    await bob.next();

    alice.send({ t: 'push', key: key(1), env: env(1) });
    await alice.next();
    await bob.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.isQuiet()).toBe(true);
  });

  it('sends a late joiner the backlog after its cursor, then synced', async () => {
    const connect = await start();
    const alice = await joined(connect);
    await alice.next();
    for (let n = 1; n <= 3; n++) {
      alice.send({ t: 'push', key: key(n), env: env(n) });
      await alice.next();
    }

    const bob = await joined(connect, 1);
    expect(await bob.next()).toEqual({ t: 'env', cursor: 2, env: env(2) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 3, env: env(3) });
    expect(await bob.next()).toEqual({ t: 'synced', cursor: 3 });
  });

  it('hands a client that remembers a cursor the server never reached the real last cursor', async () => {
    const connect = await start();
    const client = await joined(connect, 50);
    expect(await client.next()).toEqual({ t: 'synced', cursor: 0 });
  });

  it('refuses pushes before joining and a second join', async () => {
    const connect = await start();
    const client = await connect();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'not-joined', key: key(1) });
    client.send({ t: 'join', group: GROUP, after: 0 });
    await client.next();
    client.send({ t: 'join', group: OTHER_GROUP, after: 0 });
    expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
  });

  it('answers malformed and oversized frames with an error instead of closing', async () => {
    const connect = await start();
    const client = await joined(connect);
    await client.next();
    client.sendRaw('{"t":"push"}');
    expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
    client.send({ t: 'push', key: key(1), env: new Uint8Array(194) });
    expect(await client.next()).toEqual({ t: 'error', code: 'too-large', key: key(1) });
  });

  it('rate-limits a connection that pushes too fast', async () => {
    const connect = await start({
      ...DEFAULT_LIMITS,
      connectionBurst: 2,
      connectionPerSecond: 0.001,
    });
    const client = await joined(connect);
    await client.next();
    for (let n = 1; n <= 3; n++) client.send({ t: 'push', key: key(n), env: env(n) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(2) });
    expect(await client.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(3) });
  });
});
