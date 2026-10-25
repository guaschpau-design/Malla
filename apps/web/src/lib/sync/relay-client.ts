// Keeps one group's WebSocket to its server open (protocol §8): joins with the last cursor,
// passes envelopes on in order and reconnects with back-off when the link drops.

import { encodeRelayMessage, parseServerMessage, type ServerMessage } from '@malla/protocol';

/** The part of the browser's WebSocket the client uses, so tests can provide a fake. */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(text: string): void;
  close(): void;
}

export type RelayStatus = 'connecting' | 'syncing' | 'synced' | 'disconnected';

export interface RelayHandlers {
  /** The cursor to join with: the last one this device stored for the group and server. */
  readonly cursor: () => Promise<number>;
  readonly onEnvelope: (env: Uint8Array, cursor: number) => Promise<void>;
  /** The backlog is in; from now on pushes are possible. */
  readonly onSynced: (cursor: number) => Promise<void>;
  readonly onStored: (key: Uint8Array) => Promise<void>;
  readonly onStatus: (status: RelayStatus) => void;
}

export interface RelayClientOptions {
  readonly url: string;
  readonly group: Uint8Array;
  readonly handlers: RelayHandlers;
  readonly createSocket?: (url: string) => SocketLike;
  readonly random?: () => number;
}

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

export class RelayClient {
  readonly #options: RelayClientOptions;
  readonly #createSocket: (url: string) => SocketLike;
  readonly #random: () => number;
  #socket: SocketLike | null = null;
  #status: RelayStatus = 'disconnected';
  #retryMs = FIRST_RETRY_MS;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #stopped = true;
  /** Messages are handled one at a time, in arrival order, so cursors only move forward. */
  #queue: Promise<void> = Promise.resolve();

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
    this.#clearRetry();
    this.#socket?.close();
    this.#socket = null;
    this.#setStatus('disconnected');
  }

  /** Reconnects now if the link is down, for instance when the browser comes back online. */
  retryNow(): void {
    if (this.#stopped || this.#socket !== null) return;
    this.#clearRetry();
    this.#connect();
  }

  /** Sends an envelope. Returns false if the link is not synced; the caller keeps it queued. */
  push(key: Uint8Array, env: Uint8Array): boolean {
    if (this.#status !== 'synced' || this.#socket === null) return false;
    this.#socket.send(encodeRelayMessage({ t: 'push', key, env }));
    return true;
  }

  #connect(): void {
    this.#setStatus('connecting');
    const socket = this.#createSocket(this.#options.url);
    this.#socket = socket;
    socket.onopen = () => {
      this.#enqueue(async () => {
        const after = await this.#options.handlers.cursor();
        if (this.#socket !== socket) return;
        socket.send(encodeRelayMessage({ t: 'join', group: this.#options.group, after }));
        this.#setStatus('syncing');
      });
    };
    socket.onmessage = (event) => {
      const message = typeof event.data === 'string' ? parseServerMessage(event.data) : null;
      if (message !== null) this.#enqueue(() => this.#handle(message));
    };
    socket.onclose = () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#setStatus('disconnected');
      this.#scheduleRetry();
    };
  }

  async #handle(message: ServerMessage): Promise<void> {
    const { handlers } = this.#options;
    switch (message.t) {
      case 'env':
        await handlers.onEnvelope(message.env, message.cursor);
        return;
      case 'synced':
        this.#retryMs = FIRST_RETRY_MS;
        this.#setStatus('synced');
        await handlers.onSynced(message.cursor);
        return;
      case 'stored':
        await handlers.onStored(message.key);
        return;
      case 'error':
        // Refused pushes stay in the outbox and go again after the next sync.
        console.warn('Relay refused a message', message.code);
        return;
    }
  }

  #enqueue(task: () => Promise<void>): void {
    this.#queue = this.#queue.then(task).catch((error: unknown) => {
      console.warn('Relay message handling failed', error);
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

  #clearRetry(): void {
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
  }

  #setStatus(status: RelayStatus): void {
    if (status === this.#status) return;
    this.#status = status;
    this.#options.handlers.onStatus(status);
  }
}
