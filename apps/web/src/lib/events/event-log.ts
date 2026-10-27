// Each group's event log on this device (ARCHITECTURE.md §3): every event received or created,
// kept as the bytes that travel on the wire so they can be forwarded unchanged.

import {
  encodeEvent,
  isKeepable,
  peekHeader,
  type EventHeader,
  type TeselEvent,
} from '@tesel/protocol';

import type { AppDb, EventKey, OutboxEntry } from '../storage/app-db.ts';
import { cursorKey, groupCursors } from '../sync/cursor-store.ts';

/** Largest sequence number: the field is an unsigned 32-bit integer (protocol §2). */
const MAX_SEQ = 0xffff_ffff;

/** An event that cannot be encoded, mostly for being too big for the radio (protocol §2). */
export class UnencodableEvent extends Error {}

/** A received event that was new to the log. */
export interface Received {
  readonly entry: OutboxEntry;
  readonly bytes: Uint8Array;
}

export interface ReceiveOptions {
  /** The events were heard over the radio and this device bridges them: queue them for the server. */
  readonly forward?: boolean;
  /** How far a relay has been read with these events; saved with them, never ahead of them. */
  readonly readTo?: { readonly relay: string; readonly cursor: number };
}

/**
 * Stores received events in one transaction, however many: storage is what limits how fast a
 * device catches up after hours without coverage. Returns the new ones, in order. Events already
 * in the log, repeated in the batch or not events at all are skipped; events of types this
 * version does not know are kept, since they are still valid to forward (protocol §3.1).
 */
export async function receiveEvents(
  db: AppDb,
  groupId: string,
  batch: readonly Uint8Array[],
  options: ReceiveOptions = {},
): Promise<Received[]> {
  const candidates = new Map<string, Received>();
  for (const bytes of batch) {
    const header = peekHeader(bytes);
    // A damaged copy must not take the place of the real event (protocol §3.1).
    if (!header.ok || !isKeepable(bytes)) continue;
    const entry: OutboxEntry = { groupId, origin: header.value.origin, seq: header.value.seq };
    const id = `${entry.origin}:${String(entry.seq)}`;
    if (!candidates.has(id)) candidates.set(id, { entry, bytes });
  }
  // Requests are issued together and served in order by the transaction: much faster than
  // waiting for each one in turn.
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  const events = tx.objectStore('events');
  const unique = [...candidates.values()];
  const known = await Promise.all(unique.map(({ entry }) => events.getKey(eventKeyOf(entry))));
  const received = unique.filter((_, index) => known[index] === undefined);
  const writes: Promise<unknown>[] = received.map(({ entry, bytes }) =>
    events.put({ ...entry, bytes }),
  );
  if (options.forward === true) {
    writes.push(...received.map(({ entry }) => tx.objectStore('outbox').put(entry)));
  }
  if (options.readTo !== undefined) {
    const { relay, cursor } = options.readTo;
    writes.push(tx.objectStore('cursors').put(cursor, cursorKey(groupId, relay)));
  }
  await Promise.all([...writes, tx.done]);
  return received;
}

function eventKeyOf(entry: OutboxEntry): EventKey {
  return [entry.groupId, entry.origin, entry.seq];
}

export async function loadEvents(db: AppDb, groupId: string): Promise<Uint8Array[]> {
  const events = await db.getAllFromIndex('events', 'byGroup', groupId);
  return events.map((event) => event.bytes);
}

/**
 * Creates an event of this device: takes the next sequence number, encodes the event and
 * stores it in the log and the outbox in one transaction, so a crash never loses or reuses a
 * sequence number.
 */
export async function publishEvent(
  db: AppDb,
  groupId: string,
  build: (header: EventHeader) => TeselEvent,
  header: Omit<EventHeader, 'seq'>,
): Promise<{ entry: OutboxEntry; bytes: Uint8Array }> {
  const tx = db.transaction(['sequence', 'events', 'outbox'], 'readwrite');
  const sequence = tx.objectStore('sequence');
  const [seq = 1, lastTime = 0] = await Promise.all([
    sequence.get('next'),
    sequence.get('lastTime'),
  ]);
  if (seq > MAX_SEQ) throw new RangeError('this device has used every sequence number');
  // A clock put back must not make this event older than the one before (protocol §3.1).
  const time = Math.max(header.time, lastTime);
  const encoded = encodeEvent(build({ ...header, time, seq }));
  if (!encoded.ok) {
    tx.abort();
    await tx.done.catch(() => undefined); // The abort itself rejects `done`.
    throw new UnencodableEvent(`cannot encode event: ${encoded.error.detail}`);
  }
  const entry: OutboxEntry = { groupId, origin: header.origin, seq };
  await Promise.all([
    sequence.put(seq + 1, 'next'),
    sequence.put(time, 'lastTime'),
    tx.objectStore('events').put({ ...entry, bytes: encoded.value }),
    tx.objectStore('outbox').put(entry),
  ]);
  await tx.done;
  return { entry, bytes: encoded.value };
}

/** Own events the server has not confirmed yet, with their bytes. */
export async function pendingEvents(
  db: AppDb,
  groupId: string,
): Promise<{ entry: OutboxEntry; bytes: Uint8Array }[]> {
  const tx = db.transaction(['outbox', 'events']);
  const entries = await tx.objectStore('outbox').index('byGroup').getAll(groupId);
  const pending = [];
  for (const entry of entries) {
    const stored = await tx.objectStore('events').get([entry.groupId, entry.origin, entry.seq]);
    if (stored !== undefined) pending.push({ entry, bytes: stored.bytes });
  }
  await tx.done;
  return pending;
}

export async function confirmStored(db: AppDb, entry: OutboxEntry): Promise<void> {
  await db.delete('outbox', [entry.groupId, entry.origin, entry.seq]);
}

/** Notes that an own event went out over LoRa while it still waits for the server. */
export async function markAired(db: AppDb, entry: OutboxEntry): Promise<void> {
  const tx = db.transaction('outbox', 'readwrite');
  const key: EventKey = [entry.groupId, entry.origin, entry.seq];
  const current = await tx.store.get(key);
  if (current !== undefined) await tx.store.put({ ...current, aired: true });
  await tx.done;
}

/** Forgets everything a group left on this device. */
export async function deleteGroupEvents(db: AppDb, groupId: string): Promise<void> {
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  for (const name of ['events', 'outbox'] as const) {
    const store = tx.objectStore(name);
    for (const key of await store.index('byGroup').getAllKeys(groupId)) await store.delete(key);
  }
  await tx.objectStore('cursors').delete(groupCursors(groupId));
  await tx.done;
}
