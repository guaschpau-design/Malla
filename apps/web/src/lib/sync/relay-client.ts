// Keeps one group's WebSocket to a relay open (protocol §8): joins with the last cursor, passes
// envelopes on in order, in batches, and reconnects with back-off when the link drops. Each round of attempts
// tries the group's relays in order, the group's server and its command posts (§8.3), and keeps
// the first that answers.

import {
  encodeRelayMessage,
  parseServerMessage,
  relayUrl,
  type EventType,
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

/** An envelope as the relay sent it, with its cursor (protocol §8). */
export interface ReceivedEnvelope {
  readonly env: Uint8Array;
  readonly cursor: number;
}

/** Handlers that receive `relay`, the server base URL of the connection, get its own cursors. */
export interface RelayHandlers {
  /** The cursor to join with: the last one this device stored for the group and relay. */
  readonly cursor: (relay: string) => Promise<number>;
  /**
   * Envelopes that arrived together, in order. A device that has been away gets thousands at
   * once, and taking them in one go means one storage write and one redraw instead of one each.
   */
  readonly onEnvelopes: (batch: readonly ReceivedEnvelope[], relay: string) => Promise<void>;
  /** The backlog is in; from now on pushes are possible. */
  readonly onSynced: (cursor: number, relay: string) => Promise<void>;
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

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
/** A relay that has not opened by then is given up for the next one. */
const CONNECT_TIMEOUT_MS = 5000;
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
    socket.onopen = () => {
      this.#clearConnectTimer();
      this.#enqueue(socket, async () => {
        const after = await this.#options.handlers.cursor(relay);
        if (this.#socket !== socket) return;
        socket.send(encodeRelayMessage({ t: 'join', group: this.#options.group, after }));
        this.#setStatus('syncing');
      });
    };
    socket.onmessage = (event) => {
      const message = typeof event.data === 'string' ? parseServerMessage(event.data) : null;
      if (message === null) return;
      if (message.t === 'env') {
        this.#collect(socket, { env: message.env, cursor: message.cursor }, relay);
        return;
      }
      // Envelopes after this message go in a new batch, handled after it.
      this.#batch = null;
      this.#enqueue(socket, () => this.#handle(message, relay));
    };
    socket.onclose = () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#clearConnectTimer();
      this.#lost(this.#status === 'synced');
    };
  }

  /** A link that had synced starts a new round; one that never did gives way to the next relay. */
  #lost(hadSynced: boolean): void {
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
  #collect(socket: SocketLike, envelope: ReceivedEnvelope, relay: string): void {
    if (this.#batch === null || this.#batch.length >= MAX_BATCH) {
      const batch: ReceivedEnvelope[] = [];
      this.#batch = batch;
      this.#enqueue(socket, async () => {
        if (this.#batch === batch) this.#batch = null;
        await this.#options.handlers.onEnvelopes(batch, relay);
      });
    }
    this.#batch.push(envelope);
  }

  async #handle(message: Exclude<ServerMessage, { t: 'env' }>, relay: string): Promise<void> {
    const { handlers } = this.#options;
    switch (message.t) {
      case 'synced':
        this.#retryMs = FIRST_RETRY_MS;
        this.#setStatus('synced');
        await handlers.onSynced(message.cursor, relay);
        return;
      case 'stored':
        this.#pushes.stored(message.key);
        await handlers.onStored(message.key);
        return;
      case 'error':
        if (message.code === 'rate-limited' && message.key !== null) {
          this.#pushes.rateLimited(message.key);
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
