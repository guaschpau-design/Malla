// The live picture of one group: its event log on this device, kept in sync with the group's
// server, and the actions that add events to it. Components read `state` and `status`.

import {
  EMPTY_STATE,
  isOutlived,
  outlivedEvents,
  reduceAll,
  type GroupState,
  type LoraEvent,
} from '@tesel/core';
import {
  bytesEqual,
  decodeEvent,
  deriveGroupKeys,
  eventKey,
  eventRefKey,
  NO_SOS_PLACE,
  openEnvelope,
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
import { SvelteSet } from 'svelte/reactivity';

import {
  confirmStored,
  forgetEvents,
  loadEvents,
  markAired,
  pendingEvents,
  publishEvent,
  receiveEvents,
  requeueOwnEvents,
} from '../events/event-log.ts';
import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import { hear, NOTHING_HEARD, type Channel, type Heard } from '../links/heard.ts';
import type { DeviceFix } from '../position/device-location.svelte.ts';
import type { AppDb, GroupEventRef } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import { defaultServerUrl } from '../config.ts';
import type { TaskFields } from '../tasks/tasks.ts';
import { loadPosition, savePosition } from './cursor-store.ts';
import {
  RelayClient,
  type ReceivedEnvelope,
  type RelayStatus,
  type SocketLike,
} from './relay-client.ts';
import { openLogFile, sealLogFile, type LogImport } from './log-file.ts';
import { catchUpPackets, loraEventOf, peekType, type LoraSink } from './lora-events.ts';
import { relaysFor } from './relays.ts';

/** `local-only` when the group has no server: events stay on this device (and LoRa, later). */
export type FeedStatus = RelayStatus | 'local-only';

export class GroupFeed {
  state: GroupState = $state.raw(EMPTY_STATE);
  status: FeedStatus = $state('local-only');
  /** True while synced through a command post instead of the group's server (protocol §8.3). */
  viaCommandPost = $state(false);
  /** What this device has heard from each member, by channel, since the feed opened. */
  heard: Heard = $state.raw(NOTHING_HEARD);
  /**
   * Own events neither stored by a relay nor put on the air, by event reference key. A practice
   * delivers nothing, as nothing leaves the device, and so has none.
   */
  get undelivered(): ReadonlySet<string> {
    return this.#undelivered;
  }
  readonly #undelivered = new SvelteSet<string>();

  readonly #db: AppDb;
  readonly #group: StoredGroup;
  readonly #identity: LocalIdentity;
  readonly #keys: GroupKeys;
  readonly #client: RelayClient | null;
  /** Outbox entries pushed on this connection, by event key, until the server stores them. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, never rendered
  readonly #pushed = new Map<string, GroupEventRef>();
  readonly #retry = () => this.#client?.retryNow();
  #lora: LoraSink | null = null;

  private constructor(
    db: AppDb,
    group: StoredGroup,
    identity: LocalIdentity,
    createSocket: ((url: string) => SocketLike) | undefined,
  ) {
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
            ...(createSocket ? { createSocket } : {}),
            handlers: {
              position: (relay) => loadPosition(db, group.id, relay),
              onEnvelopes: (batch, relay, store) => this.#receive(batch, relay, store),
              onSynced: async (position, relay) => {
                await savePosition(db, group.id, relay, position);
                await this.#flushOutbox();
              },
              onStoreChanged: async (store, relay) => {
                await savePosition(db, group.id, relay, { cursor: 0, store });
                await requeueOwnEvents(db, group.id, identity.nodeId);
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

  /**
   * Loads the group's log, announces this member if needed and connects to the server. Loading
   * forgets what the log holds and the state has outlived, as after any batch (ADR-0055). Tests
   * pass `createSocket` to stand in for the relay.
   */
  static async open(
    db: AppDb,
    group: StoredGroup,
    identity: LocalIdentity,
    createSocket?: (url: string) => SocketLike,
  ): Promise<GroupFeed> {
    const feed = new GroupFeed(db, group, identity, createSocket);
    await feed.#apply(await loadEvents(db, group.id));
    if (!group.practice) {
      // The outbox also holds other members' events this device heard by radio and forwards: those
      // are not its to deliver.
      for (const { entry } of await pendingEvents(db, group.id)) {
        if (entry.origin === identity.nodeId && entry.aired !== true) {
          feed.#undelivered.add(eventRefKey(entry));
        }
      }
    }
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
   * §4.3). On connecting, the radio is given what it missed while there was none
   * (`catchUpPackets`).
   */
  async attachRadio(sink: LoraSink | null): Promise<void> {
    // A practice never reaches the air, whatever the caller does (ADR-0031).
    this.#lora = this.#group.practice === true ? null : sink;
    if (this.#lora === null) return;
    const pending = await pendingEvents(this.#db, this.#group.id);
    for (const packet of catchUpPackets(this.state, this.#identity.nodeId, pending)) {
      this.#lora.offer(packet, 'own');
    }
  }

  /**
   * An event this device put on the air. For a group without a server the radio is the only way
   * out, so the event leaves the outbox; otherwise the server still has to store it.
   */
  async radioSent(event: LoraEvent): Promise<void> {
    if (event.origin !== this.#identity.nodeId) return;
    const entry = { groupId: this.#group.id, origin: event.origin, seq: event.seq };
    this.#undelivered.delete(eventRefKey(entry));
    if (this.#group.server === null) await confirmStored(this.#db, entry);
    else await markAired(this.#db, entry);
  }

  /** An event heard over the radio. */
  async receiveFromRadio(bytes: Uint8Array): Promise<void> {
    const heard = loraEventOf(bytes);
    if (heard) this.#lora?.heard(heard);
    this.#hear('radio', [bytes]);
    await this.#take([bytes]);
  }

  /**
   * An event of a simulated member of a practice (lib/practice), taken like any other; a practice
   * group has no server and no radio, so it goes nowhere.
   */
  async receiveSimulated(bytes: Uint8Array): Promise<void> {
    await this.#take([bytes]);
  }

  /**
   * The group's log as a log file: every event this device keeps, which is all but the positions
   * its state has outlived (ADR-0055).
   */
  async exportLog(): Promise<string> {
    return sealLogFile(this.#keys, await loadEvents(this.#db, this.#group.id));
  }

  /** Takes the events of a log file of this group that this device is missing. */
  async importLog(text: string): Promise<LogImport> {
    const opened = openLogFile(this.#keys, text);
    if (!Array.isArray(opened)) return opened;
    const received = await this.#take(opened);
    return { kind: 'loaded', added: received, total: opened.length };
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

  /** Calls for help from `at`, or with no place when this device has no position (§3.8). */
  async sendSos(
    kind: SosKind,
    at: LatLon | null,
    accuracy: number | null,
    text: string,
  ): Promise<void> {
    const place = at === null ? NO_SOS_PLACE : { ...at, accuracy };
    await this.#publish((header) => ({ ...header, type: 'sos', kind, ...place, text }));
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
    if (!this.#group.practice) this.#undelivered.add(eventRefKey(entry));
    const [event] = await this.#apply([bytes]);
    this.#push(entry, bytes);
    if (event) this.#lora?.offer({ event, bytes }, 'own');
  }

  /**
   * Events that did not come from the group's server (by radio, from a file, from a practice):
   * the new ones are stored, applied and, with a server, passed on to it. Returns how many were new.
   */
  async #take(batch: readonly Uint8Array[]): Promise<number> {
    const forward = this.#client !== null;
    const received = await receiveEvents(this.#db, this.#group.id, this.#current(batch), {
      forward,
    });
    await this.#apply(received.map(({ bytes }) => bytes));
    for (const { entry, bytes } of received) this.#push(entry, bytes);
    return received.length;
  }

  /**
   * A batch from the relay: stored with its cursor, then applied to the picture at once. If it
   * cannot be stored, the cursor stays behind it and the relay sends it again on reconnecting; a
   * full storage is told to the user meanwhile.
   */
  async #receive(
    batch: readonly ReceivedEnvelope[],
    relay: string,
    store: string | null,
  ): Promise<void> {
    const last = batch.at(-1);
    if (last === undefined) return;
    const opened = batch.flatMap(({ key, env }) => this.#open(key, env) ?? []);
    const server = this.#group.server;
    this.#hear(server !== null && sameServer(relay, server) ? 'internet' : 'command-post', opened);
    const readTo = { relay, position: { cursor: last.cursor, store } };
    const received = await receiveEvents(this.#db, this.#group.id, this.#current(opened), {
      readTo,
    }).catch((error: unknown) => {
      storageRefusals.note(error);
      throw error;
    });
    await this.#apply(received.map(({ bytes }) => bytes));
    for (const { bytes } of received) {
      // Types this version does not know are bridged too (protocol §3.1).
      const event = loraEventOf(bytes);
      if (event) this.#lora?.offer({ event, bytes }, 'bridged');
    }
  }

  /**
   * The event in an envelope from a relay, or null for one not sealed with this group's key, or
   * stored under another event's key: the server cannot tell, so the reader checks (protocol §8).
   */
  #open(key: Uint8Array, env: Uint8Array): Uint8Array | null {
    const bytes = openEnvelope(this.#keys, env);
    if (bytes === null) return null;
    const header = peekHeader(bytes);
    if (!header.ok) return null;
    return bytesEqual(eventKey(this.#keys, header.value), key) ? bytes : null;
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

  #push(entry: GroupEventRef, bytes: Uint8Array): void {
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
    this.#undelivered.delete(eventRefKey(entry));
    await confirmStored(this.#db, entry);
  }

  /**
   * Leaves out of a batch the positions the state has outlived (ADR-0055). They change nothing, and
   * may be copies of positions this device has already forgotten, which must not count as new.
   */
  #current(batch: readonly Uint8Array[]): Uint8Array[] {
    return batch.filter((bytes) => {
      const event = decodeEvent(bytes);
      return !(event.ok && isOutlived(this.state, event.value));
    });
  }

  /**
   * Adds events to the picture in one update, so the map redraws once per batch, then forgets what
   * the new picture has outlived (ADR-0055). Returns the events decoded; those of types this
   * version does not know are kept in the log only.
   */
  async #apply(batch: readonly Uint8Array[]): Promise<TeselEvent[]> {
    const events = batch.flatMap((bytes) => {
      const event = decodeEvent(bytes);
      return event.ok ? [event.value] : [];
    });
    if (events.length === 0) return events;
    const before = this.state;
    this.state = reduceAll(before, events);
    const outlived = outlivedEvents(before, this.state, events);
    if (outlived.length > 0) {
      for (const event of outlived) this.#undelivered.delete(eventRefKey(event));
      // Housekeeping: if it fails, the events stay until the group opens again and forgets them.
      await forgetEvents(this.#db, this.#group.id, outlived).catch((error: unknown) => {
        console.warn('Forgetting outlived events failed', error);
      });
    }
    return events;
  }
}
