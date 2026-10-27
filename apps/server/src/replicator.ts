// Replication of a command post with its upstream server (docs/protocol.md §8.2). A group that
// the post's clients are in, or that has envelopes the upstream lacks, gets a link to the
// upstream (upstream-link.ts). A link is released once its group has neither, so links follow
// the groups in use; when there are more such groups than links, the most recently active win.

import { toBase64url } from '@tesel/protocol';

import { Heartbeat } from './heartbeat.ts';
import { UpstreamLink, type UpstreamLinkOptions } from './upstream-link.ts';

export interface ReplicatorOptions extends UpstreamLinkOptions {
  /** Upstream connections at most; beyond them the least recently active groups wait. */
  readonly maxLinks?: number;
}

/**
 * Anyone on a command post's Wi-Fi can join any group ID, and each group in use costs one
 * connection to the upstream: a command post serves a handful of groups, so this is plenty.
 */
const MAX_LINKS = 100;

export class Replicator {
  readonly #options: ReplicatorOptions;
  readonly #now: () => number;
  readonly #links = new Map<string, UpstreamLink>();
  /** The groups that want a link, and when each last showed activity: links go to the latest. */
  readonly #wanted = new Map<string, { readonly group: Uint8Array; readonly at: number }>();
  /** Watches the links' connections while the replicator runs; null while it is stopped. */
  #heartbeat: Heartbeat | null = null;
  #warnedFull = false;

  constructor(options: ReplicatorOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
  }

  /** Links the groups with envelopes the upstream lacks, and from then on the groups in use. */
  start(): void {
    this.#heartbeat = new Heartbeat();
    for (const group of this.#options.store.groupsPendingUpstream()) this.#consider(group);
    this.#options.relay.onGroupChange((group) => {
      if (this.#heartbeat !== null) this.#consider(group);
    });
  }

  stop(): void {
    this.#heartbeat?.stop();
    this.#heartbeat = null;
    for (const link of this.#links.values()) link.stop();
    this.#links.clear();
    this.#wanted.clear();
  }

  /** Gives the group a link, or takes it away, after something changed in it. */
  #consider(group: Uint8Array): void {
    const id = toBase64url(group);
    const { relay, store } = this.#options;
    if (relay.clientsIn(group) === 0 && store.nextPendingUpstream(group) === null) {
      this.#release(id);
      return;
    }
    this.#wanted.set(id, { group, at: this.#now() });
    const link = this.#links.get(id);
    if (link !== undefined) {
      link.pump();
      return;
    }
    if (this.#links.size >= (this.#options.maxLinks ?? MAX_LINKS)) {
      if (!this.#warnedFull) console.warn('Too many groups to replicate: the least active wait');
      this.#warnedFull = true;
      const quietest = this.#quietestLinked();
      if (quietest === null) return;
      this.#links.get(quietest)?.stop();
      this.#links.delete(quietest);
    }
    this.#open(id, group);
  }

  #open(id: string, group: Uint8Array): void {
    if (this.#heartbeat === null) return;
    const link = new UpstreamLink(group, this.#options, this.#heartbeat, () => {
      this.#consider(group);
    });
    this.#links.set(id, link);
    link.start();
  }

  /** Stops a group's link, if it has one, and hands it to the latest group waiting for one. */
  #release(id: string): void {
    this.#wanted.delete(id);
    const link = this.#links.get(id);
    if (link === undefined) return;
    link.stop();
    this.#links.delete(id);
    const next = this.#latestWaiting();
    if (next !== null) this.#open(next.id, next.group);
  }

  /** The linked group with the oldest activity. */
  #quietestLinked(): string | null {
    let quietest: { id: string; at: number } | null = null;
    for (const id of this.#links.keys()) {
      const at = this.#wanted.get(id)?.at ?? -Infinity;
      if (quietest === null || at < quietest.at) quietest = { id, at };
    }
    return quietest?.id ?? null;
  }

  /** The waiting group with the latest activity. */
  #latestWaiting(): { readonly id: string; readonly group: Uint8Array } | null {
    let latest: { id: string; group: Uint8Array; at: number } | null = null;
    for (const [id, { group, at }] of this.#wanted) {
      if (!this.#links.has(id) && (latest === null || at > latest.at)) latest = { id, group, at };
    }
    return latest;
  }
}
