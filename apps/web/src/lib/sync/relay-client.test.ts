import { encodeRelayMessage, parseClientMessage, type ServerMessage } from '@tesel/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RelayClient,
  type RelayPosition,
  type RelayStatus,
  type SocketLike,
} from './relay-client.ts';

class FakeSocket implements SocketLike {
  readonly url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.onclose?.(new Event('close') as CloseEvent);
  }

  open(): void {
    this.onopen?.(new Event('open'));
  }

  receive(message: ServerMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: encodeRelayMessage(message) }));
  }
}

const GROUP = new Uint8Array(16).fill(1);
/** The relay's store identity (protocol §8). */
const STORE = 'AAAAAAAAAAAAAAAAAAAAAA';
const flush = () => vi.advanceTimersByTimeAsync(0);

const SERVER = 'https://relay.example/';

function setup(cursor = 0, failingBatches = 0, store: string | null = null) {
  let failures = failingBatches;
  /** What the device has stored for the group. */
  let position: RelayPosition = { cursor, store };
  const storeChanges: string[] = [];
  const sockets: FakeSocket[] = [];
  const statuses: RelayStatus[] = [];
  /** Each batch handed on, as its envelopes' cursors. */
  const envelopes: number[][] = [];
  /** Batches and syncs in the order they were handled. */
  const handled: string[] = [];
  const synced: number[] = [];
  const client = new RelayClient({
    server: SERVER,
    group: GROUP,
    random: () => 0.5,
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    handlers: {
      position: () => Promise.resolve(position),
      onEnvelopes: (batch) => {
        if (failures-- > 0) return Promise.reject(new Error('disk full'));
        envelopes.push(batch.map((envelope) => envelope.cursor));
        handled.push(`batch of ${String(batch.length)}`);
        return Promise.resolve();
      },
      onSynced: (at) => {
        position = at;
        synced.push(at.cursor);
        handled.push(`synced at ${String(at.cursor)}`);
        return Promise.resolve();
      },
      onStoreChanged: (changed) => {
        position = { cursor: 0, store: changed };
        storeChanges.push(changed);
        return Promise.resolve();
      },
      onStored: () => Promise.resolve(),
      onStatus: (status) => statuses.push(status),
    },
  });
  return { client, sockets, statuses, envelopes, handled, synced, storeChanges };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('relay client', () => {
  it('joins with the stored cursor and passes the backlog on in order', async () => {
    const { client, sockets, statuses, envelopes, synced } = setup(41);
    client.start();
    await flush();
    const socket = sockets[0];
    if (!socket) throw new Error('no socket');
    socket.open();
    await flush();
    expect(parseClientMessage(socket.sent[0] ?? '')).toEqual({
      ok: true,
      value: { t: 'join', group: GROUP, after: 41 },
    });
    socket.receive({ t: 'env', cursor: 42, key: new Uint8Array(16), env: new Uint8Array(50) });
    socket.receive({ t: 'env', cursor: 43, key: new Uint8Array(16), env: new Uint8Array(50) });
    socket.receive({ t: 'synced', cursor: 43, store: STORE });
    await flush();
    expect(envelopes).toEqual([[42, 43]]);
    expect(synced).toEqual([43]);
    expect(socket.url).toBe('wss://relay.example/v1/ws');
    expect(statuses).toEqual(['connecting', 'syncing', 'synced']);
  });

  it('hands envelopes on in batches that never cross another message', async () => {
    const { client, sockets, envelopes, handled } = setup();
    client.start();
    await flush();
    const socket = sockets[0];
    if (!socket) throw new Error('no socket');
    socket.open();
    await flush();
    const env = (cursor: number) => ({
      t: 'env' as const,
      cursor,
      key: new Uint8Array(16),
      env: new Uint8Array(50),
    });
    for (let cursor = 1; cursor <= 1001; cursor++) socket.receive(env(cursor));
    socket.receive({ t: 'synced', cursor: 1001, store: STORE });
    socket.receive(env(1002));
    await flush();
    expect(envelopes.map((batch) => batch.length)).toEqual([1000, 1, 1]);
    expect(envelopes.flat()).toEqual(Array.from({ length: 1002 }, (_, i) => i + 1));
    expect(handled).toEqual(['batch of 1000', 'batch of 1', 'synced at 1001', 'batch of 1']);
  });

  it('joins again from the stored cursor when a batch cannot be taken', async () => {
    const { client, sockets, envelopes, synced, statuses } = setup(7, 1);
    client.start();
    await flush();
    const first = sockets[0];
    if (!first) throw new Error('no socket');
    first.open();
    await flush();
    first.receive({ t: 'env', cursor: 8, key: new Uint8Array(16), env: new Uint8Array(50) });
    first.receive({ t: 'synced', cursor: 8, store: STORE });
    await flush();
    // The sync after the lost batch must not store a cursor past it.
    expect(synced).toEqual([]);
    expect(statuses.at(-1)).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    const second = sockets[1];
    if (!second) throw new Error('no second socket');
    second.open();
    await flush();
    expect(parseClientMessage(second.sent[0] ?? '')).toEqual({
      ok: true,
      value: { t: 'join', group: GROUP, after: 7 },
    });
    second.receive({ t: 'env', cursor: 8, key: new Uint8Array(16), env: new Uint8Array(50) });
    second.receive({ t: 'synced', cursor: 8, store: STORE });
    await flush();
    expect(envelopes).toEqual([[8]]);
    expect(synced).toEqual([8]);
  });

  it('starts over when the relay has another store than the one it read from', async () => {
    const OLD = 'BBBBBBBBBBBBBBBBBBBBBA';
    const { client, sockets, synced, storeChanges } = setup(500, 0, OLD);
    client.start();
    await flush();
    const first = sockets[0];
    if (!first) throw new Error('no socket');
    first.open();
    await flush();
    first.receive({ t: 'synced', cursor: 20, store: STORE });
    await flush();
    expect(storeChanges).toEqual([STORE]);
    expect(synced).toEqual([]);
    // It joins again at once, from the start of the new store.
    const second = sockets[1];
    if (!second) throw new Error('no second socket');
    expect(second.url).toBe(first.url);
    second.open();
    await flush();
    expect(parseClientMessage(second.sent[0] ?? '')).toEqual({
      ok: true,
      value: { t: 'join', group: GROUP, after: 0 },
    });
    second.receive({ t: 'synced', cursor: 20, store: STORE });
    await flush();
    expect(synced).toEqual([20]);
    expect(client.status).toBe('synced');
  });

  it('gives up a link that stays silent after a ping, and connects again', async () => {
    const { client, sockets, statuses } = setup();
    client.start();
    await flush();
    const socket = sockets[0];
    if (!socket) throw new Error('no socket');
    socket.open();
    await flush();
    socket.receive({ t: 'synced', cursor: 0, store: STORE });
    await flush();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(parseClientMessage(socket.sent.at(-1) ?? '')).toEqual({
      ok: true,
      value: { t: 'ping' },
    });
    // A pong keeps the link.
    socket.receive({ t: 'pong' });
    await vi.advanceTimersByTimeAsync(25_000 + 19_000);
    expect(client.status).toBe('synced');
    // Silence after the next ping does not.
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe('disconnected');
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
  });

  it('only pushes once synced', async () => {
    const { client, sockets } = setup();
    client.start();
    await flush();
    const socket = sockets[0];
    if (!socket) throw new Error('no socket');
    socket.open();
    await flush();
    expect(client.push(new Uint8Array(16), new Uint8Array(50), 'chat')).toBe(false);
    socket.receive({ t: 'synced', cursor: 0, store: STORE });
    await flush();
    expect(client.push(new Uint8Array(16), new Uint8Array(50), 'chat')).toBe(true);
  });

  it('reconnects with growing delays after the link drops', async () => {
    const { client, sockets } = setup();
    client.start();
    await flush();
    sockets[0]?.close();
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
    sockets[1]?.close();
    await vi.advanceTimersByTimeAsync(1999);
    expect(sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(3);
  });

  it('reconnects at once when asked, and not at all once stopped', async () => {
    const { client, sockets } = setup();
    client.start();
    await flush();
    sockets[0]?.close();
    client.retryNow();
    await flush();
    expect(sockets).toHaveLength(2);
    client.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(2);
  });

  it('gives up a connection that does not open in time, and tries again later', async () => {
    const { client, sockets, statuses } = setup();
    client.start();
    await flush();
    await vi.advanceTimersByTimeAsync(4999);
    expect(statuses.at(-1)).toBe('connecting');
    await vi.advanceTimersByTimeAsync(1);
    expect(statuses.at(-1)).toBe('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
  });
});
