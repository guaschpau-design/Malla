// Keeps one group's WebSocket to a relay open (protocol §8): joins with the last cursor, passes
// envelopes on in order, in batches, and reconnects with back-off when the link drops. Each round of attempts
// tries the group's relays in order, the group's server and its command posts (§8.3), and keeps
// the first that answers.

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

/** Handlers that receive `relay`, the server base URL of the connection, get its own cursors. */
export interface RelayHandlers {
  /** Where to join from: what this device last stored for the group and relay. */
  readonly position: (relay: string) => Promise<RelayPosition>;
  /**
   * Envelopes that arrived together, in order, read from `store`. A device that has been away
   * gets thousands at once, and taking them in one go means one storage write and one redraw
   * instead of one each.
   */
  readonly onEnvelopes: (
    batch: readonly ReceivedEnvelope[],
    relay: string,
    store: string | null,
  ) => Promise<void>;
  /** The backlog is in; from now on pushes are possible. */
  readonly onSynced: (position: RelayPosition, relay: string) => Promise<void>;
  /**
   * The relay's store is not the one this device read from: it lost its data or was restored
   * from a backup. What this device knew of it is void; the handler starts over from the start of
   * the new store and offers its own events again. The client then joins again.
   */
  readonly onStoreChanged: (store: string, relay: string) => Promise<void>;
  readonly onStored: (key: Uint8Array) => Promise<void>;
  readonly onStatus: (status: RelayStatus) => void;
}

export interface RelayClientOptions {
  /** Server base URLs to try, in order; asked again before every round of attempts. */
  readonly relays: () => Promise<readonly string[]>;
  readonly group: Uint8Array;
  readonly handlers: RelayHandlers;
  readonly createSocket?: (url: string) => SocketLike;
  readonly random?: () => number;
}

/** One connection to a relay, as its messages are handled. */
interface Link {
  readonly socket: SocketLike;
  readonly relay: string;
  /** The store it reads from as far as this device knew when it joined. */
  readonly store: string | null;
}

/** Refusals of a push that will do for another try a little later. */
const TRY_LATER: ReadonlySet<RelayErrorCode> = new Set(['rate-limited', 'unavailable']);

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
/** A relay that has not opened by then is given up for the next one. */
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
  #relays: readonly string[] = [];
  #index = 0;
  #round = 0;
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

  /** The relay connected to or being tried, or null between rounds. */
  get relay(): string | null {
    return this.#socket === null ? null : (this.#relays[this.#index] ?? null);
  }

  start(): void {
    this.#stopped = false;
    void this.#newRound();
  }

  stop(): void {
    this.#stopped = true;
    this.#round += 1;
    this.#pushes.clear();
    this.#clearTimers();
    this.#socket?.close();
    this.#socket = null;
    this.#setStatus('disconnected');
  }

  /** Reconnects now if the link is down, for instance when the browser comes back online. */
  retryNow(): void {
    if (this.#stopped || this.#socket !== null || this.#retryTimer === null) return;
    this.#clearTimers();
    void this.#newRound();
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

  async #newRound(): Promise<void> {
    const round = ++this.#round;
    this.#setStatus('connecting');
    let relays: readonly string[] = [];
    try {
      relays = await this.#options.relays();
    } catch (error) {
      console.warn('No relays to try', error);
    }
    if (this.#stopped || round !== this.#round) return;
    this.#relays = relays;
    this.#index = 0;
    this.#connect();
  }

  #connect(): void {
    const relay = this.#relays[this.#index];
    if (relay === undefined) {
      this.#setStatus('disconnected');
      this.#scheduleRetry();
      return;
    }
    const socket = this.#createSocket(relayUrl(relay));
    this.#socket = socket;
    this.#batch = null;
    this.#connectTimer = setTimeout(() => {
      this.#connectTimer = null;
      this.#socket = null;
      socket.close();
      this.#lost(false);
    }, CONNECT_TIMEOUT_MS);
    /** The store this link reads from, as far as this device knows. */
    let store: string | null = null;
    socket.onopen = () => {
      this.#clearConnectTimer();
      this.#heard(socket);
      this.#enqueue(socket, async () => {
        const position = await this.#options.handlers.position(relay);
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
        this.#collect(socket, { key, env, cursor }, relay, store);
        return;
      }
      // Envelopes after this message go in a new batch, handled after it.
      this.#batch = null;
      this.#enqueue(socket, () => this.#handle(message, { socket, relay, store }));
    };
    socket.onclose = () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#clearConnectTimer();
      this.#lost(this.#status === 'synced');
    };
  }

  /** The link said something: it is alive, and is asked again only after a quiet spell. */
  #heard(socket: SocketLike): void {
    this.#clearHeartbeat();
    this.#heartbeat = setTimeout(() => {
      socket.send(encodeRelayMessage({ t: 'ping' }));
      this.#heartbeat = setTimeout(() => {
        this.#heartbeat = null;
        if (this.#socket !== socket) return;
        this.#socket = null;
        socket.close();
        this.#lost(this.#status === 'synced');
      }, PONG_TIMEOUT_MS);
    }, QUIET_MS);
  }

  #clearHeartbeat(): void {
    if (this.#heartbeat !== null) clearTimeout(this.#heartbeat);
    this.#heartbeat = null;
  }

  /** Joins the same relay again at once, from the position the handlers now give. */
  #rejoin(socket: SocketLike): void {
    if (this.#socket !== socket) return;
    this.#clearHeartbeat();
    this.#socket = null;
    socket.close();
    this.#pushes.clear();
    this.#connect();
  }

  /** A link that had synced starts a new round; one that never did gives way to the next relay. */
  #lost(hadSynced: boolean): void {
    this.#clearHeartbeat();
    this.#pushes.clear();
    if (this.#stopped) return;
    if (hadSynced) {
      this.#setStatus('disconnected');
      this.#scheduleRetry();
      return;
    }
    this.#index += 1;
    this.#connect();
  }

  /** Adds an envelope to the waiting batch, or queues a new batch if none is waiting or it is full. */
  #collect(
    socket: SocketLike,
    envelope: ReceivedEnvelope,
    relay: string,
    store: string | null,
  ): void {
    if (this.#batch === null || this.#batch.length >= MAX_BATCH) {
      const batch: ReceivedEnvelope[] = [];
      this.#batch = batch;
      this.#enqueue(socket, async () => {
        if (this.#batch === batch) this.#batch = null;
        await this.#options.handlers.onEnvelopes(batch, relay, store);
      });
    }
    this.#batch.push(envelope);
  }

  async #handle(message: Exclude<ServerMessage, { t: 'env' | 'pong' }>, link: Link): Promise<void> {
    const { handlers } = this.#options;
    const { relay } = link;
    switch (message.t) {
      case 'synced':
        if (link.store !== null && link.store !== message.store) {
          await handlers.onStoreChanged(message.store, relay);
          this.#rejoin(link.socket);
          return;
        }
        this.#retryMs = FIRST_RETRY_MS;
        this.#setStatus('synced');
        await handlers.onSynced({ cursor: message.cursor, store: message.store }, relay);
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
        if (this.#socket !== socket) return;
        this.#socket = null;
        socket.close();
        this.#lost(true);
      });
  }

  #scheduleRetry(): void {
    if (this.#stopped) return;
    // Jitter spreads reconnections when a server comes back with many clients waiting.
    const delay = this.#retryMs * (0.5 + this.#random());
    this.#retryMs = Math.min(this.#retryMs * 2, MAX_RETRY_MS);
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      void this.#newRound();
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
