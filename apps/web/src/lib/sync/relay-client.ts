// Keeps one group's WebSocket to its server open (protocol §8): joins with the last cursor, passes
// envelopes on in order, in batches, and reconnects with back-off when the link drops.

import {
  encodeRelayMessage,
  parseServerMessage,
  relayUrl,
  type EventType,
  type RelayErrorCode,
  type ServerMessage,
} from '@tesel/protocol';

import { PushQueue } from './push-queue.ts';

/** The part of the browser's WebSocket the client uses, so tests can provide a fake. */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(text: string): void;
  close(): void;
}

export type RelayStatus = 'connecting' | 'syncing' | 'synced' | 'disconnected';

/** An envelope as the relay sent it, with its event key and cursor (protocol §8). */
export interface ReceivedEnvelope {
  readonly key: Uint8Array;
  readonly env: Uint8Array;
  readonly cursor: number;
}

/**
 * How far this device has read a group on a relay: a cursor of the relay's store, whose identity
 * is null until the relay has told it (protocol §8).
 */
export interface RelayPosition {
  readonly cursor: number;
  readonly store: string | null;
}

interface RelayHandlers {
  /** Where to join from: what this device last stored for the group. */
  readonly position: () => Promise<RelayPosition>;
  /**
   * Envelopes that arrived together, in order, read from `store`. A device that has been away
   * gets thousands at once, and taking them in one go means one storage write and one redraw
   * instead of one each.
   */
  readonly onEnvelopes: (batch: readonly ReceivedEnvelope[], store: string | null) => Promise<void>;
  /** The backlog is in; from now on pushes are possible. */
  readonly onSynced: (position: RelayPosition) => Promise<void>;
  /**
   * The relay's store is not the one this device read from: it lost its data or was restored
   * from a backup. What this device knew of it is void; the handler starts over from the start of
   * the new store and offers its own events again. The client then joins again.
   */
  readonly onStoreChanged: (store: string) => Promise<void>;
  readonly onStored: (key: Uint8Array) => Promise<void>;
  /** Each try to connect starts with `connecting`. */
  readonly onStatus: (status: RelayStatus) => void;
}

export interface RelayClientOptions {
  /** The group's server, by its base URL. */
  readonly server: string;
  readonly group: Uint8Array;
  readonly handlers: RelayHandlers;
  readonly createSocket?: (url: string) => SocketLike;
  readonly random?: () => number;
}

/** One connection to the server, as its messages are handled. */
interface Link {
  readonly socket: SocketLike;
  /** The store it reads from as far as this device knew when it joined. */
  readonly store: string | null;
}

/** Refusals of a push that will do for another try a little later. */
const TRY_LATER: ReadonlySet<RelayErrorCode> = new Set(['rate-limited', 'unavailable']);

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
/** A connection that has not opened by then is given up, and tried again later. */
const CONNECT_TIMEOUT_MS = 5000;
/**
 * A link silent this long is asked whether it is still there with a ping, and given up if nothing
 * comes back within the second span: a connection that died without closing, as on a phone that
 * changed networks, is noticed within 45 seconds instead of looking synced for ever.
 */
const QUIET_MS = 25_000;
const PONG_TIMEOUT_MS = 20_000;
/** Largest batch of envelopes handed on at once, so that no single step blocks the app for long. */
const MAX_BATCH = 1000;

export class RelayClient {
  readonly #options: RelayClientOptions;
  readonly #createSocket: (url: string) => SocketLike;
  readonly #random: () => number;
  #socket: SocketLike | null = null;
  #status: RelayStatus = 'disconnected';
  #retryMs = FIRST_RETRY_MS;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #connectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Until the open link is asked for a sign of life, or, once asked, given up. */
  #heartbeat: ReturnType<typeof setTimeout> | null = null;
  #stopped = true;
  /**
   * Messages are handled one at a time, in arrival order, so cursors only move forward. If one
   * fails, the rest of that link's messages are dropped and the link closed: joining again from
   * the last stored cursor brings back what was lost, instead of a later cursor skipping it.
   */
  #queue: Promise<void> = Promise.resolve();
  /** The batch envelopes join while it waits in the queue; null once it starts or is closed. */
  #batch: ReceivedEnvelope[] | null = null;
  readonly #pushes = new PushQueue((key, env) => {
    this.#socket?.send(encodeRelayMessage({ t: 'push', key, env }));
  });

  constructor(options: RelayClientOptions) {
    this.#options = options;
    this.#createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.#random = options.random ?? Math.random;
  }

  get status(): RelayStatus {
    return this.#status;
  }

  start(): void {
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    this.#pushes.clear();
    this.#clearTimers();
    if (this.#socket !== null) this.#drop(this.#socket);
    this.#setStatus('disconnected');
  }

  /** Reconnects now if the link is down, for instance when the browser comes back online. */
  retryNow(): void {
    if (this.#stopped || this.#socket !== null || this.#retryTimer === null) return;
    this.#clearTimers();
    this.#connect();
  }

  /**
   * Queues an envelope for the relay, most urgent first. Returns false if the link is not synced;
   * the caller keeps it in its outbox and offers it again after the next sync.
   */
  push(key: Uint8Array, env: Uint8Array, type: EventType | null): boolean {
    if (this.#status !== 'synced' || this.#socket === null) return false;
    this.#pushes.add(key, env, type);
    return true;
  }

  #connect(): void {
    this.#setStatus('connecting');
    const socket = this.#createSocket(relayUrl(this.#options.server));
    this.#socket = socket;
    this.#batch = null;
    this.#connectTimer = setTimeout(() => {
      this.#connectTimer = null;
      if (this.#drop(socket)) this.#lost();
    }, CONNECT_TIMEOUT_MS);
    /** The store this link reads from, as far as this device knows. */
    let store: string | null = null;
    socket.onopen = () => {
      this.#clearConnectTimer();
      this.#heard(socket);
      this.#enqueue(socket, async () => {
        const position = await this.#options.handlers.position();
        if (this.#socket !== socket) return;
        store = position.store;
        const join = { t: 'join', group: this.#options.group, after: position.cursor } as const;
        socket.send(encodeRelayMessage(join));
        this.#setStatus('syncing');
      });
    };
    socket.onmessage = (event) => {
      this.#heard(socket);
      const message = typeof event.data === 'string' ? parseServerMessage(event.data) : null;
      if (message === null || message.t === 'pong') return;
      if (message.t === 'env') {
        const { key, env, cursor } = message;
        this.#collect(socket, { key, env, cursor }, store);
        return;
      }
      // Envelopes after this message go in a new batch, handled after it.
      this.#batch = null;
      this.#enqueue(socket, () => this.#handle(message, { socket, store }));
    };
    socket.onclose = () => {
      if (this.#drop(socket)) this.#lost();
    };
  }

  /** The link said something: it is alive, and is asked again only after a quiet spell. */
  #heard(socket: SocketLike): void {
    this.#clearHeartbeat();
    this.#heartbeat = setTimeout(() => {
      socket.send(encodeRelayMessage({ t: 'ping' }));
      this.#heartbeat = setTimeout(() => {
        this.#heartbeat = null;
        if (this.#drop(socket)) this.#lost();
      }, PONG_TIMEOUT_MS);
    }, QUIET_MS);
  }

  #clearHeartbeat(): void {
    if (this.#heartbeat !== null) clearTimeout(this.#heartbeat);
    this.#heartbeat = null;
  }

  /** Joins again at once, from the position the handlers now give. */
  #rejoin(socket: SocketLike): void {
    if (!this.#drop(socket)) return;
    this.#pushes.clear();
    this.#connect();
  }

  /**
   * Lets go of a link: it is closed and no longer the one in use, and its timers stop. Returns
   * false if it already was let go, so whatever let go of it first decides what comes next.
   */
  #drop(socket: SocketLike): boolean {
    if (this.#socket !== socket) return false;
    this.#socket = null;
    this.#clearConnectTimer();
    this.#clearHeartbeat();
    socket.close();
    return true;
  }

  /** The link is gone: it is tried again after a wait that grows while it keeps failing. */
  #lost(): void {
    this.#pushes.clear();
    if (this.#stopped) return;
    this.#setStatus('disconnected');
    this.#scheduleRetry();
  }

  /** Adds an envelope to the waiting batch, or queues a new batch if none is waiting or it is full. */
  #collect(socket: SocketLike, envelope: ReceivedEnvelope, store: string | null): void {
    if (this.#batch === null || this.#batch.length >= MAX_BATCH) {
      const batch: ReceivedEnvelope[] = [];
      this.#batch = batch;
      this.#enqueue(socket, async () => {
        if (this.#batch === batch) this.#batch = null;
        await this.#options.handlers.onEnvelopes(batch, store);
      });
    }
    this.#batch.push(envelope);
  }

  async #handle(message: Exclude<ServerMessage, { t: 'env' | 'pong' }>, link: Link): Promise<void> {
    const { handlers } = this.#options;
    switch (message.t) {
      case 'synced':
        if (link.store !== null && link.store !== message.store) {
          await handlers.onStoreChanged(message.store);
          this.#rejoin(link.socket);
          return;
        }
        this.#retryMs = FIRST_RETRY_MS;
        this.#setStatus('synced');
        await handlers.onSynced({ cursor: message.cursor, store: message.store });
        return;
      case 'stored':
        this.#pushes.stored(message.key);
        await handlers.onStored(message.key);
        return;
      case 'error':
        if (TRY_LATER.has(message.code) && message.key !== null) {
          this.#pushes.tryLater(message.key);
          return;
        }
        // Anything else refused stays in the outbox and goes again after the next sync.
        console.warn('Relay refused a message', message.code);
        return;
    }
  }

  /** Queues the handling of a message of `socket`; it is skipped once that link is gone. */
  #enqueue(socket: SocketLike, task: () => Promise<void>): void {
    this.#queue = this.#queue
      .then(() => (this.#socket === socket ? task() : undefined))
      .catch((error: unknown) => {
        console.warn('Relay message handling failed', error);
        if (this.#drop(socket)) this.#lost();
      });
  }

  #scheduleRetry(): void {
    if (this.#stopped) return;
    // Jitter spreads reconnections when a server comes back with many clients waiting.
    const delay = this.#retryMs * (0.5 + this.#random());
    this.#retryMs = Math.min(this.#retryMs * 2, MAX_RETRY_MS);
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.#connect();
    }, delay);
  }

  #clearTimers(): void {
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    this.#clearConnectTimer();
    this.#clearHeartbeat();
  }

  #clearConnectTimer(): void {
    if (this.#connectTimer !== null) clearTimeout(this.#connectTimer);
    this.#connectTimer = null;
  }

  #setStatus(status: RelayStatus): void {
    if (status === this.#status) return;
    this.#status = status;
    this.#options.handlers.onStatus(status);
  }
}
