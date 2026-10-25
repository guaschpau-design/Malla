// Pushes waiting for a relay (protocol §8): the most urgent first, and paced below the server's
// per-connection rate limit, so catching up after hours offline neither gets refused nor holds
// an SOS behind a backlog of positions. A push the server refuses for going too fast goes again
// a little later; the outbox keeps everything until the server confirms it.

import { TokenBucket, urgencyOf } from '@teselia/core';
import { toBase64url, type EventType } from '@teselia/protocol';

/** Below the server's 30 pushes at once and 3 per second (apps/server/src/relay.ts). */
const PUSH_BURST = 20;
const PUSHES_PER_SECOND = 2;
/** When nothing may go now, look again this much later. */
const PACE_MS = 500;
/** Wait after the server refuses a push for going too fast. */
const RATE_LIMITED_WAIT_MS = 5000;

interface Push {
  readonly id: string;
  readonly key: Uint8Array;
  readonly env: Uint8Array;
  readonly urgency: number;
}

export class PushQueue {
  readonly #send: (key: Uint8Array, env: Uint8Array) => void;
  readonly #now: () => number;
  readonly #bucket: TokenBucket;
  /** Not sent yet, most urgent first and in arrival order within the same urgency. */
  #waiting: Push[] = [];
  /** Sent, until the server stores or refuses them. */
  readonly #sent = new Map<string, Push>();
  /** Pushes refused for going too fast, waiting to queue again. */
  readonly #retries = new Set<ReturnType<typeof setTimeout>>();
  #paceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(send: (key: Uint8Array, env: Uint8Array) => void, now: () => number = Date.now) {
    this.#send = send;
    this.#now = now;
    this.#bucket = new TokenBucket(PUSH_BURST, PUSHES_PER_SECOND, now());
  }

  add(key: Uint8Array, env: Uint8Array, type: EventType | null): void {
    const id = toBase64url(key);
    if (this.#sent.has(id) || this.#waiting.some((push) => push.id === id)) return;
    this.#insert({ id, key, env, urgency: urgencyOf(type) });
    this.#drain();
  }

  stored(key: Uint8Array): void {
    this.#sent.delete(toBase64url(key));
  }

  /** The server refused a push for going too fast: it goes again a little later. */
  rateLimited(key: Uint8Array): void {
    const id = toBase64url(key);
    const push = this.#sent.get(id);
    if (push === undefined) return;
    this.#sent.delete(id);
    const timer = setTimeout(() => {
      this.#retries.delete(timer);
      this.#insert(push);
      this.#drain();
    }, RATE_LIMITED_WAIT_MS);
    this.#retries.add(timer);
  }

  /** The connection is gone: what was not stored goes again from the outbox after the next sync. */
  clear(): void {
    this.#waiting = [];
    this.#sent.clear();
    for (const timer of this.#retries) clearTimeout(timer);
    this.#retries.clear();
    if (this.#paceTimer !== null) clearTimeout(this.#paceTimer);
    this.#paceTimer = null;
  }

  #insert(push: Push): void {
    const at = this.#waiting.findIndex((other) => other.urgency > push.urgency);
    if (at === -1) this.#waiting.push(push);
    else this.#waiting.splice(at, 0, push);
  }

  #drain(): void {
    while (this.#waiting.length > 0 && this.#bucket.take(this.#now())) {
      const push = this.#waiting.shift();
      if (push === undefined) break;
      this.#sent.set(push.id, push);
      this.#send(push.key, push.env);
    }
    if (this.#waiting.length > 0 && this.#paceTimer === null) {
      this.#paceTimer = setTimeout(() => {
        this.#paceTimer = null;
        this.#drain();
      }, PACE_MS);
    }
  }
}
