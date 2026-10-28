// The relay's limits, which keep one client, one address or one group from taking the server for
// itself: open connections in all and per client address, groups the server does not know that
// one address may open, and pushes per connection, per group and in all.

import { TokenBucket } from '@tesel/core';

import { KeyedBuckets } from './keyed-buckets.ts';

export interface RelayLimits {
  /**
   * Sustained pushes per second allowed to one connection, to a whole group and to the whole
   * server. Each lets BURST_SECONDS' worth through at once.
   */
  readonly connectionPerSecond: number;
  readonly groupPerSecond: number;
  readonly serverPerSecond: number;
  /** Open connections at most, in all and from one client address. */
  readonly maxConnections: number;
  readonly maxConnectionsPerAddress: number;
  /** Groups the server does not know that clients at one address may join in an hour. */
  readonly newGroupsPerAddressPerHour: number;
  /** A connection that has not joined a group by then is closed. */
  readonly joinTimeoutMs: number;
}

export const DEFAULT_LIMITS: RelayLimits = {
  connectionPerSecond: 3,
  groupPerSecond: 30,
  serverPerSecond: 500,
  maxConnections: 10_000,
  // Phones behind a carrier's NAT share one address.
  maxConnectionsPerAddress: 256,
  newGroupsPerAddressPerHour: 120,
  joinTimeoutMs: 10_000,
};

/** A push rate limit lets this many seconds' worth of pushes through at once. */
const BURST_SECONDS = 10;
const SECONDS_PER_HOUR = 3600;

/** Applies the limits; it counts connections, and keeps the buckets of pushes and new groups. */
export class Limiter {
  readonly #limits: RelayLimits;
  readonly #groupBuckets: KeyedBuckets;
  readonly #newGroupBuckets: KeyedBuckets;
  readonly #serverBucket: TokenBucket;
  readonly #connectionsByAddress = new Map<string, number>();
  #connections = 0;

  constructor(limits: RelayLimits, now: number) {
    this.#limits = limits;
    this.#groupBuckets = new KeyedBuckets(
      limits.groupPerSecond * BURST_SECONDS,
      limits.groupPerSecond,
    );
    this.#newGroupBuckets = new KeyedBuckets(
      limits.newGroupsPerAddressPerHour,
      limits.newGroupsPerAddressPerHour / SECONDS_PER_HOUR,
    );
    this.#serverBucket = new TokenBucket(
      limits.serverPerSecond * BURST_SECONDS,
      limits.serverPerSecond,
      now,
    );
  }

  get joinTimeoutMs(): number {
    return this.#limits.joinTimeoutMs;
  }

  /** Whether one more connection from `address` is within the limits. */
  admits(address: string): boolean {
    return (
      this.#connections < this.#limits.maxConnections &&
      (this.#connectionsByAddress.get(address) ?? 0) < this.#limits.maxConnectionsPerAddress
    );
  }

  opened(address: string): void {
    this.#connections += 1;
    this.#connectionsByAddress.set(address, (this.#connectionsByAddress.get(address) ?? 0) + 1);
  }

  closed(address: string): void {
    this.#connections -= 1;
    const left = (this.#connectionsByAddress.get(address) ?? 1) - 1;
    if (left === 0) this.#connectionsByAddress.delete(address);
    else this.#connectionsByAddress.set(address, left);
  }

  /** Takes one of the address's new groups for this hour, if it has one left. */
  mayOpenGroup(address: string, now: number): boolean {
    return this.#newGroupBuckets.take(address, now);
  }

  /** A new connection's own push bucket. */
  connectionBucket(now: number): TokenBucket {
    const perSecond = this.#limits.connectionPerSecond;
    return new TokenBucket(perSecond * BURST_SECONDS, perSecond, now);
  }

  /** Takes a push from the connection's, the group's and the server's buckets, if all have one. */
  allowsPush(connectionBucket: TokenBucket, group: string, now: number): boolean {
    return (
      connectionBucket.take(now) &&
      this.#groupBuckets.take(group, now) &&
      this.#serverBucket.take(now)
    );
  }
}
