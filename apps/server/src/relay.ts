// The internet transport (docs/protocol.md §8): stores pushed envelopes and fans them out to the
// other connections of the same group. One connection carries one group. On a command post the
// replicator (replicator.ts) hands in what the upstream has and learns what clients push.

import { TokenBucket } from '@teselia/core';
import {
  encodeRelayMessage,
  parseClientMessage,
  toBase64url,
  type ServerMessage,
} from '@teselia/protocol';
import WebSocket from 'ws';

import type { EnvelopeSource, EnvelopeStore, StoredEnvelope } from './envelope-store.ts';
import { frameText } from './ws-text.ts';

export interface RelayLimits {
  /** Burst and sustained pushes per second allowed to one connection. */
  readonly connectionBurst: number;
  readonly connectionPerSecond: number;
  /** Burst and sustained pushes per second allowed to a whole group. */
  readonly groupBurst: number;
  readonly groupPerSecond: number;
}

export const DEFAULT_LIMITS: RelayLimits = {
  connectionBurst: 30,
  connectionPerSecond: 3,
  groupBurst: 300,
  groupPerSecond: 30,
};

/** Backlog envelopes read from the database at a time. */
const BACKLOG_PAGE = 500;

interface GroupRoom {
  readonly sockets: Set<WebSocket>;
  readonly bucket: TokenBucket;
}

/** Called when a client joins a group or pushes a new envelope to it. */
export type GroupActivityListener = (group: Uint8Array) => void;

export class Relay {
  readonly #store: EnvelopeStore;
  readonly #now: () => number;
  readonly #limits: RelayLimits;
  readonly #rooms = new Map<string, GroupRoom>();
  readonly #listeners: GroupActivityListener[] = [];

  constructor(store: EnvelopeStore, now: () => number, limits: RelayLimits = DEFAULT_LIMITS) {
    this.#store = store;
    this.#now = now;
    this.#limits = limits;
  }

  /** Number of open connections, for health reporting. */
  get connections(): number {
    let total = 0;
    for (const room of this.#rooms.values()) total += room.sockets.size;
    return total;
  }

  onGroupActivity(listener: GroupActivityListener): void {
    this.#listeners.push(listener);
  }

  /** Stores an envelope received from the upstream and relays it to every client of the group. */
  ingest(group: Uint8Array, key: Uint8Array, env: Uint8Array): void {
    this.#append(group, key, env, 'upstream', null);
  }

  accept(socket: WebSocket): void {
    const bucket = new TokenBucket(
      this.#limits.connectionBurst,
      this.#limits.connectionPerSecond,
      this.#now(),
    );
    let joined: { readonly group: Uint8Array; readonly room: GroupRoom } | null = null;

    socket.on('message', (data, isBinary) => {
      const parsed = isBinary
        ? ({ ok: false, error: { code: 'bad-request', key: null } } as const)
        : parseClientMessage(frameText(data));
      if (!parsed.ok) {
        send(socket, { t: 'error', code: parsed.error.code, key: parsed.error.key });
        return;
      }
      const message = parsed.value;
      switch (message.t) {
        case 'join':
          if (joined !== null) {
            send(socket, { t: 'error', code: 'bad-request', key: null });
            return;
          }
          joined = { group: message.group, room: this.#join(socket, message.group, message.after) };
          this.#notify(message.group);
          return;
        case 'push': {
          if (joined === null) {
            send(socket, { t: 'error', code: 'not-joined', key: message.key });
            return;
          }
          if (!this.#allowPush(joined.room, bucket)) {
            send(socket, { t: 'error', code: 'rate-limited', key: message.key });
            return;
          }
          const isNew = this.#append(joined.group, message.key, message.env, 'client', socket);
          send(socket, { t: 'stored', key: message.key });
          if (isNew) this.#notify(joined.group);
          return;
        }
      }
    });

    socket.on('close', () => {
      if (joined !== null) this.#leave(socket, joined.group);
    });
  }

  /** Stores an envelope and relays it to the group's clients but its sender; false if known. */
  #append(
    group: Uint8Array,
    key: Uint8Array,
    env: Uint8Array,
    source: EnvelopeSource,
    sender: WebSocket | null,
  ): boolean {
    const { cursor, isNew } = this.#store.append(group, key, env, this.#now(), source);
    if (!isNew) return false;
    for (const other of this.#rooms.get(toBase64url(group))?.sockets ?? []) {
      if (other !== sender) send(other, { t: 'env', cursor, key, env });
    }
    return true;
  }

  #notify(group: Uint8Array): void {
    for (const listener of this.#listeners) listener(group);
  }

  /**
   * Sends the backlog and `synced`, then adds the socket to the group's room. Everything here is
   * synchronous, so no live envelope can slip in between the backlog and the room.
   */
  #join(socket: WebSocket, group: Uint8Array, after: number): GroupRoom {
    const last = this.#store.lastCursor(group);
    // A cursor beyond the last one comes from before a data loss: the client gets everything
    // there is and adopts the store's cursor (protocol §8).
    let cursor = after > last ? 0 : after;
    let page: StoredEnvelope[];
    do {
      page = this.#store.after(group, cursor, BACKLOG_PAGE);
      for (const stored of page) {
        send(socket, { t: 'env', cursor: stored.cursor, key: stored.key, env: stored.env });
        cursor = stored.cursor;
      }
    } while (page.length === BACKLOG_PAGE);
    send(socket, { t: 'synced', cursor: last });

    const id = toBase64url(group);
    let room = this.#rooms.get(id);
    if (room === undefined) {
      room = {
        sockets: new Set(),
        bucket: new TokenBucket(this.#limits.groupBurst, this.#limits.groupPerSecond, this.#now()),
      };
      this.#rooms.set(id, room);
    }
    room.sockets.add(socket);
    return room;
  }

  #allowPush(room: GroupRoom, bucket: TokenBucket): boolean {
    const now = this.#now();
    return bucket.take(now) && room.bucket.take(now);
  }

  #leave(socket: WebSocket, group: Uint8Array): void {
    const id = toBase64url(group);
    const room = this.#rooms.get(id);
    room?.sockets.delete(socket);
    if (room?.sockets.size === 0) this.#rooms.delete(id);
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(encodeRelayMessage(message));
}
