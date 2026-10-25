import { encodeRelayMessage, parseClientMessage, type ServerMessage } from '@malla/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RelayClient, type RelayStatus, type SocketLike } from './relay-client.ts';

class FakeSocket implements SocketLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: string[] = [];

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

function setup(cursor = 0) {
  const sockets: FakeSocket[] = [];
  const statuses: RelayStatus[] = [];
  const envelopes: number[] = [];
  const synced: number[] = [];
  const client = new RelayClient({
    url: 'wss://relay.example/v1/ws',
    group: GROUP,
    random: () => 0.5,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    handlers: {
      cursor: () => Promise.resolve(cursor),
      onEnvelope: (_env, at) => {
        envelopes.push(at);
        return Promise.resolve();
      },
      onSynced: (at) => {
        synced.push(at);
        return Promise.resolve();
      },
      onStored: () => Promise.resolve(),
      onStatus: (status) => statuses.push(status),
    },
  });
  return { client, sockets, statuses, envelopes, synced };
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
    const socket = sockets[0];
    if (!socket) throw new Error('no socket');
    socket.open();
    await flush();
    expect(parseClientMessage(socket.sent[0] ?? '')).toEqual({
      ok: true,
      value: { t: 'join', group: GROUP, after: 41 },
    });
    socket.receive({ t: 'env', cursor: 42, env: new Uint8Array(50) });
    socket.receive({ t: 'env', cursor: 43, env: new Uint8Array(50) });
    socket.receive({ t: 'synced', cursor: 43 });
    await flush();
    expect(envelopes).toEqual([42, 43]);
    expect(synced).toEqual([43]);
    expect(statuses).toEqual(['connecting', 'syncing', 'synced']);
  });

  it('only pushes once synced', async () => {
    const { client, sockets } = setup();
    client.start();
    const socket = sockets[0];
    if (!socket) throw new Error('no socket');
    socket.open();
    await flush();
    expect(client.push(new Uint8Array(16), new Uint8Array(50))).toBe(false);
    socket.receive({ t: 'synced', cursor: 0 });
    await flush();
    expect(client.push(new Uint8Array(16), new Uint8Array(50))).toBe(true);
  });

  it('reconnects with growing delays after the link drops', async () => {
    const { client, sockets } = setup();
    client.start();
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
    sockets[0]?.close();
    client.retryNow();
    expect(sockets).toHaveLength(2);
    client.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(2);
  });
});
