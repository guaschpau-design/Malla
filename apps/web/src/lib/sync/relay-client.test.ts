import { encodeRelayMessage, parseClientMessage, type ServerMessage } from '@teselia/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RelayClient, type RelayStatus, type SocketLike } from './relay-client.ts';

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
const flush = () => vi.advanceTimersByTimeAsync(0);

const SERVER = 'https://relay.example/';
const POST = 'https://post.example/';

function setup(cursor = 0, relays: readonly string[] = [SERVER]) {
  const sockets: FakeSocket[] = [];
  const statuses: RelayStatus[] = [];
  const envelopes: number[] = [];
  const synced: string[] = [];
  const cursorsAsked: string[] = [];
  const client = new RelayClient({
    relays: () => Promise.resolve(relays),
    group: GROUP,
    random: () => 0.5,
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    handlers: {
      cursor: (relay) => {
        cursorsAsked.push(relay);
        return Promise.resolve(cursor);
      },
      onEnvelope: (_env, at) => {
        envelopes.push(at);
        return Promise.resolve();
      },
      onSynced: (at, relay) => {
        synced.push(`${at}@${relay}`);
        return Promise.resolve();
      },
      onStored: () => Promise.resolve(),
      onStatus: (status) => statuses.push(status),
    },
  });
  return { client, sockets, statuses, envelopes, synced, cursorsAsked };
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
    socket.receive({ t: 'synced', cursor: 43 });
    await flush();
    expect(envelopes).toEqual([42, 43]);
    expect(synced).toEqual([`43@${SERVER}`]);
    expect(client.relay).toBe(SERVER);
    expect(statuses).toEqual(['connecting', 'syncing', 'synced']);
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
    socket.receive({ t: 'synced', cursor: 0 });
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

  it('moves on to the next relay when one cannot be reached, and starts each round from the first', async () => {
    const { client, sockets, cursorsAsked } = setup(0, [SERVER, POST]);
    client.start();
    await flush();
    sockets[0]?.close();
    expect(sockets.map((socket) => socket.url)).toEqual([
      'wss://relay.example/v1/ws',
      'wss://post.example/v1/ws',
    ]);
    const post = sockets[1];
    if (!post) throw new Error('no socket');
    post.open();
    await flush();
    post.receive({ t: 'synced', cursor: 3 });
    await flush();
    expect(cursorsAsked).toEqual([POST]);
    expect(client.relay).toBe(POST);

    post.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets[2]?.url).toBe('wss://relay.example/v1/ws');
  });

  it('gives up a relay that does not open in time', async () => {
    const { client, sockets } = setup(0, [SERVER, POST]);
    client.start();
    await flush();
    await vi.advanceTimersByTimeAsync(4999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets[1]?.url).toBe('wss://post.example/v1/ws');
  });

  it('waits before a new round once every relay has failed', async () => {
    const { client, sockets, statuses } = setup(0, [SERVER, POST]);
    client.start();
    await flush();
    sockets[0]?.close();
    sockets[1]?.close();
    expect(statuses.at(-1)).toBe('disconnected');
    expect(client.relay).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(3);
  });
});
