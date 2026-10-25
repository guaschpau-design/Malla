// The live picture of one group: its event log on this device, kept in sync with the group's
// server, and the actions that add events to it. Components read `state` and `status`.

import { EMPTY_STATE, reduce, type GroupState } from '@malla/core';
import {
  decodeEvent,
  deriveGroupKeys,
  eventKey,
  openEnvelope,
  relayUrl,
  sealEnvelope,
  toBase64url,
  type EventHeader,
  type GroupKeys,
  type MallaEvent,
} from '@malla/protocol';

import {
  confirmStored,
  loadEvents,
  pendingEvents,
  publishEvent,
  receiveEvent,
} from '../events/event-log.ts';
import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import type { AppDb, OutboxEntry } from '../storage/app-db.ts';
import { loadCursor, saveCursor } from './cursor-store.ts';
import { RelayClient, type RelayStatus } from './relay-client.ts';

/** `local-only` when the group has no server: events stay on this device (and LoRa, later). */
export type FeedStatus = RelayStatus | 'local-only';

/** A position as the device reports it, in protocol units. */
export interface Fix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number | null;
  readonly heading: number | null;
  readonly speed: number | null;
}

export class GroupFeed {
  state: GroupState = $state.raw(EMPTY_STATE);
  status: FeedStatus = $state('local-only');

  readonly #db: AppDb;
  readonly #group: StoredGroup;
  readonly #identity: LocalIdentity;
  readonly #keys: GroupKeys;
  readonly #client: RelayClient | null;
  /** Outbox entries pushed on this connection, by event key, until the server stores them. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, never rendered
  readonly #pushed = new Map<string, OutboxEntry>();
  readonly #retry = () => this.#client?.retryNow();

  private constructor(db: AppDb, group: StoredGroup, identity: LocalIdentity) {
    this.#db = db;
    this.#group = group;
    this.#identity = identity;
    this.#keys = deriveGroupKeys(group.secret);
    const server = group.server;
    this.#client =
      server === null
        ? null
        : new RelayClient({
            url: relayUrl(server),
            group: this.#keys.groupId,
            handlers: {
              cursor: () => loadCursor(db, group.id, server),
              onEnvelope: (env, cursor) => this.#receive(env, server, cursor),
              onSynced: async (cursor) => {
                await saveCursor(db, group.id, server, cursor);
                await this.#flushOutbox();
              },
              onStored: (key) => this.#confirm(key),
              onStatus: (status) => (this.status = status),
            },
          });
  }

  /** Loads the group's log, announces this member if needed and connects to the server. */
  static async open(db: AppDb, group: StoredGroup, identity: LocalIdentity): Promise<GroupFeed> {
    const feed = new GroupFeed(db, group, identity);
    for (const bytes of await loadEvents(db, group.id)) feed.#apply(bytes);
    await feed.#announceSelf();
    if (feed.#client) {
      window.addEventListener('online', feed.#retry);
      document.addEventListener('visibilitychange', feed.#retry);
      feed.#client.start();
    }
    return feed;
  }

  get groupId(): string {
    return this.#group.id;
  }

  close(): void {
    window.removeEventListener('online', this.#retry);
    document.removeEventListener('visibilitychange', this.#retry);
    this.#client?.stop();
  }

  async sendChat(text: string): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'chat', text }));
  }

  async sharePosition(fix: Fix): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'position', ...fix }));
  }

  async hidePosition(): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'position-hidden' }));
  }

  /** Publishes MEMBER_INFO if the group does not know this device's current alias and role. */
  async #announceSelf(): Promise<void> {
    const known = this.state.members.get(this.#identity.nodeId);
    if (known?.alias === this.#identity.alias && known.role === this.#group.role) return;
    await this.#publish((header) => ({
      ...header,
      type: 'member-info',
      role: this.#group.role,
      publicKey: this.#identity.publicKey,
      alias: this.#identity.alias,
    }));
  }

  async #publish(build: (header: EventHeader) => MallaEvent): Promise<void> {
    const header = { origin: this.#identity.nodeId, time: Math.floor(Date.now() / 1000) };
    const { entry, bytes } = await publishEvent(this.#db, this.#group.id, build, header);
    this.#apply(bytes);
    this.#push(entry, bytes);
  }

  async #receive(env: Uint8Array, server: string, cursor: number): Promise<void> {
    // An envelope that does not open was not sealed with this group's key: skip it.
    const bytes = openEnvelope(this.#keys, env);
    if (bytes !== null && (await receiveEvent(this.#db, this.#group.id, bytes))) this.#apply(bytes);
    await saveCursor(this.#db, this.#group.id, server, cursor);
  }

  async #flushOutbox(): Promise<void> {
    for (const { entry, bytes } of await pendingEvents(this.#db, this.#group.id)) {
      this.#push(entry, bytes);
    }
  }

  #push(entry: OutboxEntry, bytes: Uint8Array): void {
    if (this.#client === null) return;
    const key = eventKey(this.#keys, entry);
    if (this.#client.push(key, sealEnvelope(this.#keys, bytes))) {
      this.#pushed.set(toBase64url(key), entry);
    }
  }

  async #confirm(key: Uint8Array): Promise<void> {
    const id = toBase64url(key);
    const entry = this.#pushed.get(id);
    if (entry === undefined) return;
    this.#pushed.delete(id);
    await confirmStored(this.#db, entry);
  }

  /** Adds an event to the picture; events of unknown types are kept in the log only. */
  #apply(bytes: Uint8Array): void {
    const event = decodeEvent(bytes);
    if (event.ok) this.state = reduce(this.state, event.value);
  }
}
