// The live picture of one group: its event log on this device, kept in sync with the group's
// server, and the actions that add events to it. Components read `state` and `status`.

import {
  EMPTY_STATE,
  reduceAll,
  type GroupState,
  type LoraEvent,
  type LoraPacket,
  type LoraSource,
} from '@tesel/core';
import {
  decodeEvent,
  deriveGroupKeys,
  encodeEvent,
  encodeLogFile,
  eventKey,
  openEnvelope,
  parseLogFile,
  peekHeader,
  sameServer,
  sealEnvelope,
  toBase64url,
  type EventHeader,
  type EventRef,
  type GroupKeys,
  type LatLon,
  type ObjectRef,
  type ShapeGeometry,
  type SosKind,
  type TeselEvent,
} from '@tesel/protocol';

import {
  confirmStored,
  loadEvents,
  pendingEvents,
  publishEvent,
  receiveEvents,
} from '../events/event-log.ts';
import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import { hear, NOTHING_HEARD, type Heard } from '../links/heard.ts';
import type { Channel } from '../links/links.ts';
import type { DeviceFix } from '../position/device-location.svelte.ts';
import type { AppDb, OutboxEntry } from '../storage/app-db.ts';
import { defaultServerUrl } from '../config.ts';
import type { TaskFields } from '../tasks/tasks.ts';
import { loadCursor, saveCursor } from './cursor-store.ts';
import { RelayClient, type ReceivedEnvelope, type RelayStatus } from './relay-client.ts';
import { loraEventOf, peekType } from './lora-events.ts';
import { relaysFor } from './relays.ts';

/** `local-only` when the group has no server: events stay on this device (and LoRa, later). */
export type FeedStatus = RelayStatus | 'local-only';

/** What loading a log file did (protocol §10). */
export type LogImport =
  | { readonly kind: 'loaded'; readonly added: number; readonly total: number }
  | { readonly kind: 'other-group' }
  | { readonly kind: 'unreadable' };

/** Where the feed hands events for the radio: the LoRa scheduler of a connected radio. */
export interface LoraSink {
  offer(packet: LoraPacket, source: LoraSource): void;
  heard(event: LoraEvent): void;
}

export class GroupFeed {
  state: GroupState = $state.raw(EMPTY_STATE);
  status: FeedStatus = $state('local-only');
  /** True while synced through a command post instead of the group's server (protocol §8.3). */
  viaCommandPost = $state(false);
  /** What this device has heard from each member, by channel, since the feed opened. */
  heard: Heard = $state.raw(NOTHING_HEARD);

  readonly #db: AppDb;
  readonly #group: StoredGroup;
  readonly #identity: LocalIdentity;
  readonly #keys: GroupKeys;
  readonly #client: RelayClient | null;
  /** Outbox entries pushed on this connection, by event key, until the server stores them. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, never rendered
  readonly #pushed = new Map<string, OutboxEntry>();
  readonly #retry = () => this.#client?.retryNow();
  #lora: LoraSink | null = null;

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
            relays: () => relaysFor(db, server, defaultServerUrl()),
            group: this.#keys.groupId,
            handlers: {
              cursor: (relay) => loadCursor(db, group.id, relay),
              onEnvelopes: (batch, relay) => this.#receive(batch, relay),
              onSynced: async (cursor, relay) => {
                await saveCursor(db, group.id, relay, cursor);
                await this.#flushOutbox();
              },
              onStored: (key) => this.#confirm(key),
              onStatus: (status) => {
                this.status = status;
                const relay = this.#client?.relay ?? null;
                this.viaCommandPost =
                  status === 'synced' && relay !== null && !sameServer(relay, server);
              },
            },
          });
  }

  /** Loads the group's log, announces this member if needed and connects to the server. */
  static async open(db: AppDb, group: StoredGroup, identity: LocalIdentity): Promise<GroupFeed> {
    const feed = new GroupFeed(db, group, identity);
    feed.#apply(await loadEvents(db, group.id));
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

  get groupName(): string {
    return this.#group.name;
  }

  /** The radio channel of the group: its name and secret (protocol §7). */
  get radioChannel(): { readonly name: string; readonly secret: Uint8Array } {
    return { name: this.#group.name, secret: this.#group.secret };
  }

  /**
   * Connects the feed to a radio, or disconnects it with null. While connected, own events go
   * on the air too, and so do events from the server: this device bridges them (ARCHITECTURE.md
   * §4.3).
   */
  attachRadio(sink: LoraSink | null): void {
    this.#lora = sink;
    // Members who only hear the radio learn this device's alias from its announcement.
    const announcement = this.state.members.get(this.#identity.nodeId);
    if (sink === null || announcement === undefined) return;
    const bytes = encodeEvent(announcement);
    if (bytes.ok) sink.offer({ event: announcement, bytes: bytes.value }, 'own');
  }

  /** An event heard over the radio. New ones are applied and, with a server, forwarded to it. */
  async receiveFromRadio(bytes: Uint8Array): Promise<void> {
    const heard = loraEventOf(bytes);
    if (heard) this.#lora?.heard(heard);
    this.#hear('radio', [bytes]);
    const forward = this.#client !== null;
    const [received] = await receiveEvents(this.#db, this.#group.id, [bytes], { forward });
    if (received === undefined) return;
    this.#apply([bytes]);
    this.#push(received.entry, bytes);
  }

  /** The group's whole log as a log file, sealed so that only the group can read it. */
  async exportLog(): Promise<string> {
    const events = await loadEvents(this.#db, this.#group.id);
    const envelopes = events.map((bytes) => sealEnvelope(this.#keys, bytes));
    return encodeLogFile({ groupId: this.#keys.groupId, envelopes });
  }

  /**
   * Adds the events of a log file of this group that this device is missing, as if a relay had
   * brought them: they are applied and, with a server, passed on to it.
   */
  async importLog(text: string): Promise<LogImport> {
    const file = parseLogFile(text);
    if (!file.ok) return { kind: 'unreadable' };
    if (toBase64url(file.value.groupId) !== toBase64url(this.#keys.groupId)) {
      return { kind: 'other-group' };
    }
    const opened = file.value.envelopes.flatMap((env) => openEnvelope(this.#keys, env) ?? []);
    const forward = this.#client !== null;
    const received = await receiveEvents(this.#db, this.#group.id, opened, { forward });
    this.#apply(received.map(({ bytes }) => bytes));
    for (const { entry, bytes } of received) this.#push(entry, bytes);
    return { kind: 'loaded', added: received.length, total: opened.length };
  }

  close(): void {
    window.removeEventListener('online', this.#retry);
    document.removeEventListener('visibilitychange', this.#retry);
    this.#client?.stop();
  }

  async sendChat(text: string): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'chat', text }));
  }

  async sharePosition({ at, accuracy, heading, speed }: DeviceFix): Promise<void> {
    await this.#publish((header) => ({
      ...header,
      type: 'position',
      ...at,
      accuracy,
      heading,
      speed,
    }));
  }

  async hidePosition(): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'position-hidden' }));
  }

  /** Creates a marker; the event's own reference becomes the object's (protocol §3.10). */
  async placeMarker(at: LatLon, symbol: number, label: string): Promise<void> {
    await this.#publish((header) => ({
      ...header,
      type: 'marker',
      object: { origin: header.origin, seq: header.seq },
      symbol,
      ...at,
      label,
    }));
  }

  async drawShape(geometry: ShapeGeometry, style: number, label: string): Promise<void> {
    await this.#publish((header) => ({
      ...header,
      type: 'shape',
      object: { origin: header.origin, seq: header.seq },
      style,
      label,
      geometry,
    }));
  }

  async deleteObject(object: ObjectRef): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'object-delete', object }));
  }

  async sendSos(kind: SosKind, at: LatLon, accuracy: number | null, text: string): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'sos', kind, ...at, accuracy, text }));
  }

  async cancelSos(sos: EventRef): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'sos-cancel', sos }));
  }

  async acknowledge(target: EventRef): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'ack', target }));
  }

  /** Sends a critical alert: the one kind the app sends (ADR-0026). */
  async sendAlert(text: string): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'alert', level: 'critical', text }));
  }

  /** Calls the roll with the usual question, which each receiver words in its language (§3.12). */
  async callRoll(): Promise<void> {
    await this.#publish((header) => ({ ...header, type: 'roll-call', text: '' }));
  }

  /**
   * Creates a task, or changes the task `task` refers to; a new task's reference is its own event's
   * (protocol §3.11).
   */
  async writeTask(task: EventRef | null, fields: TaskFields): Promise<void> {
    await this.#publish((header) => ({
      ...header,
      type: 'task',
      task: task ?? { origin: header.origin, seq: header.seq },
      ...fields,
    }));
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

  async #publish(build: (header: EventHeader) => TeselEvent): Promise<void> {
    const header = { origin: this.#identity.nodeId, time: Math.floor(Date.now() / 1000) };
    const { entry, bytes } = await publishEvent(this.#db, this.#group.id, build, header);
    const [event] = this.#apply([bytes]);
    this.#push(entry, bytes);
    if (event) this.#lora?.offer({ event, bytes }, 'own');
  }

  /** A batch from the relay: stored with its cursor, then applied to the picture at once. */
  async #receive(batch: readonly ReceivedEnvelope[], relay: string): Promise<void> {
    const last = batch.at(-1);
    if (last === undefined) return;
    // An envelope that does not open was not sealed with this group's key: skip it.
    const opened = batch.flatMap(({ env }) => openEnvelope(this.#keys, env) ?? []);
    const server = this.#group.server;
    this.#hear(server !== null && sameServer(relay, server) ? 'internet' : 'command-post', opened);
    const readTo = { relay, cursor: last.cursor };
    const received = await receiveEvents(this.#db, this.#group.id, opened, { readTo });
    this.#apply(received.map(({ bytes }) => bytes));
    for (const { bytes } of received) {
      // Types this version does not know are bridged too (protocol §3.1).
      const event = loraEventOf(bytes);
      if (event) this.#lora?.offer({ event, bytes }, 'bridged');
    }
  }

  /** Notes the members heard through a channel; own events are not news about anyone. */
  #hear(channel: Channel, batch: readonly Uint8Array[]): void {
    const headers = batch.flatMap((bytes) => {
      const header = peekHeader(bytes);
      return header.ok && header.value.origin !== this.#identity.nodeId ? [header.value] : [];
    });
    this.heard = hear(this.heard, channel, headers);
  }

  async #flushOutbox(): Promise<void> {
    for (const { entry, bytes } of await pendingEvents(this.#db, this.#group.id)) {
      this.#push(entry, bytes);
    }
  }

  #push(entry: OutboxEntry, bytes: Uint8Array): void {
    if (this.#client === null) return;
    const key = eventKey(this.#keys, entry);
    const type = peekType(bytes);
    if (this.#client.push(key, sealEnvelope(this.#keys, bytes), type)) {
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

  /**
   * Adds events to the picture in one update, so the map redraws once per batch. Returns the ones
   * decoded; events of types this version does not know are kept in the log only.
   */
  #apply(batch: readonly Uint8Array[]): TeselEvent[] {
    const events = batch.flatMap((bytes) => {
      const event = decodeEvent(bytes);
      return event.ok ? [event.value] : [];
    });
    if (events.length > 0) this.state = reduceAll(this.state, events);
    return events;
  }
}
