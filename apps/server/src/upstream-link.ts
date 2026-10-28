// One group's link from a command post to its upstream (docs/protocol.md §8.2): it joins the
// group at the upstream as an ordinary client, stores and relays what arrives, and pushes what
// the post's clients pushed, one envelope at a time and under the upstream's rate limits, until
// the upstream confirms it. replicator.ts decides which groups have a link.

import { TokenBucket } from '@tesel/core';
import {
  encodeRelayMessage,
  parseServerMessage,
  relayUrl,
  toBase64url,
  type ServerMessage,
} from '@tesel/protocol';
import WebSocket from 'ws';

import type { EnvelopeStore } from './envelope-store.ts';
import type { Heartbeat } from './heartbeat.ts';
import type { Relay } from './relay.ts';
import { frameText, MAX_FRAME_BYTES } from './ws-text.ts';

export interface UpstreamLinkOptions {
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
/** An upstream that has not completed the WebSocket handshake by then is tried again later. */
const HANDSHAKE_TIMEOUT_MS = 10_000;
/** Wait after the upstream refuses a push for going too fast, or for being unable to store it. */
const REFUSED_WAIT_MS = 5000;
/** Wait for a token when the post's own push rate is spent. */
const TOKEN_WAIT_MS = 1000;

/** One group's connection to the upstream. */
export class UpstreamLink {
  readonly #group: Uint8Array;
  readonly #store: EnvelopeStore;
  readonly #relay: Relay;
  readonly #url: string;
  readonly #now: () => number;
  readonly #bucket: TokenBucket;
  readonly #heartbeat: Heartbeat;
  /** Called when the upstream has confirmed everything that was pending. */
  readonly #onDrained: () => void;
  #socket: WebSocket | null = null;
  #synced = false;
  /** The push awaiting `stored`; one at a time keeps the upstream's order. */
  #inFlight: { readonly key: string; readonly cursor: number } | null = null;
  #retryMs = FIRST_RETRY_MS;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;

  constructor(
    group: Uint8Array,
    options: UpstreamLinkOptions,
    heartbeat: Heartbeat,
    onDrained: () => void,
  ) {
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
    this.#heartbeat = heartbeat;
    this.#onDrained = onDrained;
  }

  start(): void {
    const socket = new WebSocket(this.#url, {
      handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
      maxPayload: MAX_FRAME_BYTES,
    });
    this.#socket = socket;
    socket.on('open', () => {
      this.#heartbeat.watch(socket);
      const after = this.#store.upstreamCursor(this.#group);
      socket.send(encodeRelayMessage({ t: 'join', group: this.#group, after }));
    });
    socket.on('message', (data) => {
      const message = parseServerMessage(frameText(data));
      if (message === null) return;
      try {
        this.#handle(message);
      } catch (error) {
        // Most likely the store could not write: start over later from what it holds.
        console.error('Replication of a group failed:', error);
        socket.terminate();
      }
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
      this.#wait(TOKEN_WAIT_MS);
      return;
    }
    this.#inFlight = { key: toBase64url(pending.key), cursor: pending.cursor };
    this.#socket?.send(encodeRelayMessage({ t: 'push', key: pending.key, env: pending.env }));
  }

  #handle(message: ServerMessage): void {
    switch (message.t) {
      case 'env':
        this.#relay.ingest(this.#group, message.key, message.env);
        this.#store.setUpstreamCursor(this.#group, message.cursor);
        return;
      case 'synced':
        this.#retryMs = FIRST_RETRY_MS;
        if (this.#upstreamChanged(message.store)) {
          // The upstream lost its data or was replaced (ADR-0046): read it again from the start,
          // on a new connection, and give it back everything this post holds for the group.
          this.#store.restartUpstream(this.#group, message.store);
          this.#socket?.close();
          return;
        }
        this.#store.setUpstreamPosition(this.#group, message.cursor, message.store);
        this.#synced = true;
        this.pump();
        return;
      case 'stored':
        this.#confirm(message.key);
        return;
      case 'error':
        if (message.code === 'rate-limited' || message.code === 'unavailable') {
          this.#inFlight = null;
          this.#wait(REFUSED_WAIT_MS);
        } else if (message.key !== null) {
          // The upstream will never take this envelope; holding it would block the rest.
          console.warn('Upstream refused an envelope', message.code);
          this.#confirm(message.key);
        }
        return;
      case 'pong':
        // This link checks its upstream with WebSocket pings (heartbeat.ts) and never asks.
        return;
    }
  }

  /** Whether the upstream answers from another store than when this group last synced. */
  #upstreamChanged(store: string): boolean {
    const known = this.#store.upstreamStore(this.#group);
    return known !== null && known !== store;
  }

  /** Marks the push in flight as done, if `key` is its key, and pushes the next one. */
  #confirm(key: Uint8Array): void {
    const inFlight = this.#inFlight;
    if (inFlight?.key !== toBase64url(key)) return;
    this.#store.markUpstreamStored(this.#group, inFlight.cursor);
    this.#inFlight = null;
    if (this.#store.nextPendingUpstream(this.#group) === null) this.#onDrained();
    else this.pump();
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
