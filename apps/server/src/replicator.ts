// Replication of a command post with its upstream server (docs/protocol.md §8.2). For every group
// the post stores, one link joins the group at the upstream as an ordinary client: what arrives is
// stored and relayed to the post's clients, and what the post's clients pushed goes up, one
// envelope at a time and under the upstream's rate limits, until the upstream confirms it.

import {
  encodeRelayMessage,
  parseServerMessage,
  relayUrl,
  toBase64url,
  type ServerMessage,
} from '@teselia/protocol';
import WebSocket from 'ws';

import type { EnvelopeStore } from './envelope-store.ts';
import type { Relay } from './relay.ts';
import { TokenBucket } from './token-bucket.ts';
import { frameText } from './ws-text.ts';

export interface ReplicatorOptions {
  readonly store: EnvelopeStore;
  readonly relay: Relay;
  /** Base URL of the upstream server. */
  readonly upstream: string;
  readonly now?: () => number;
  /** Pushes per second, burst and sustained; below the upstream's per-connection limits. */
  readonly pushBurst?: number;
  readonly pushesPerSecond?: number;
}

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 60_000;
/** Wait after the upstream refuses a push for going too fast. */
const RATE_LIMITED_WAIT_MS = 5000;

export class Replicator {
  readonly #options: ReplicatorOptions;
  readonly #links = new Map<string, UpstreamLink>();
  #stopped = false;

  constructor(options: ReplicatorOptions) {
    this.#options = options;
  }

  /** Starts a link for every stored group, and for every group clients use from now on. */
  start(): void {
    for (const group of this.#options.store.groups()) this.#link(group);
    this.#options.relay.onGroupActivity((group) => {
      if (!this.#stopped) this.#link(group).pump();
    });
  }

  stop(): void {
    this.#stopped = true;
    for (const link of this.#links.values()) link.stop();
    this.#links.clear();
  }

  #link(group: Uint8Array): UpstreamLink {
    const id = toBase64url(group);
    let link = this.#links.get(id);
    if (link === undefined) {
      link = new UpstreamLink(group, this.#options);
      this.#links.set(id, link);
      link.start();
    }
    return link;
  }
}

/** One group's connection to the upstream. */
class UpstreamLink {
  readonly #group: Uint8Array;
  readonly #store: EnvelopeStore;
  readonly #relay: Relay;
  readonly #url: string;
  readonly #now: () => number;
  readonly #bucket: TokenBucket;
  #socket: WebSocket | null = null;
  #synced = false;
  /** Key of the push awaiting `stored`; one at a time keeps the upstream's order. */
  #inFlight: string | null = null;
  #retryMs = FIRST_RETRY_MS;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;

  constructor(group: Uint8Array, options: ReplicatorOptions) {
    this.#group = group;
    this.#store = options.store;
    this.#relay = options.relay;
    this.#url = relayUrl(options.upstream);
    this.#now = options.now ?? Date.now;
    this.#bucket = new TokenBucket(
      options.pushBurst ?? 20,
      options.pushesPerSecond ?? 2,
      this.#now(),
    );
  }

  start(): void {
    const socket = new WebSocket(this.#url);
    this.#socket = socket;
    socket.on('open', () => {
      const after = this.#store.upstreamCursor(this.#group);
      socket.send(encodeRelayMessage({ t: 'join', group: this.#group, after }));
    });
    socket.on('message', (data) => {
      const message = parseServerMessage(frameText(data));
      if (message !== null) this.#handle(message);
    });
    socket.on('error', () => {
      // A refused or broken connection also emits close, which retries.
    });
    socket.on('close', () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#synced = false;
      this.#inFlight = null;
      this.#retryLater();
    });
  }

  stop(): void {
    this.#stopped = true;
    this.#clearTimer();
    this.#socket?.close();
    this.#socket = null;
  }

  /** Pushes the oldest envelope the upstream lacks, if the link is ready for it. */
  pump(): void {
    if (!this.#synced || this.#inFlight !== null || this.#timer !== null) return;
    const pending = this.#store.nextPendingUpstream(this.#group);
    if (pending === null) return;
    if (!this.#bucket.take(this.#now())) {
      this.#wait(1000);
      return;
    }
    this.#inFlight = toBase64url(pending.key);
    this.#socket?.send(encodeRelayMessage({ t: 'push', key: pending.key, env: pending.env }));
  }

  #handle(message: ServerMessage): void {
    switch (message.t) {
      case 'env':
        this.#relay.ingest(this.#group, message.key, message.env);
        this.#store.setUpstreamCursor(this.#group, message.cursor);
        return;
      case 'synced':
        this.#store.setUpstreamCursor(this.#group, message.cursor);
        this.#synced = true;
        this.#retryMs = FIRST_RETRY_MS;
        this.pump();
        return;
      case 'stored':
        this.#confirm(message.key);
        return;
      case 'error':
        if (message.code === 'rate-limited') {
          this.#inFlight = null;
          this.#wait(RATE_LIMITED_WAIT_MS);
        } else if (message.key !== null) {
          // The upstream will never take this envelope; holding it would block the rest.
          console.warn('Upstream refused an envelope', message.code);
          this.#confirm(message.key);
        }
        return;
    }
  }

  #confirm(key: Uint8Array): void {
    this.#store.markUpstreamStored(this.#group, key);
    if (this.#inFlight === toBase64url(key)) this.#inFlight = null;
    this.pump();
  }

  #wait(ms: number): void {
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.pump();
    }, ms);
  }

  #retryLater(): void {
    if (this.#stopped) return;
    this.#clearTimer();
    const delay = this.#retryMs * (0.5 + Math.random());
    this.#retryMs = Math.min(this.#retryMs * 2, MAX_RETRY_MS);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.start();
    }, delay);
  }

  #clearTimer(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
