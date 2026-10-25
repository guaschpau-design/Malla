// Each group's event log on this device (ARCHITECTURE.md §3): every event received or created,
// kept as the bytes that travel on the wire so they can be forwarded unchanged.

import { encodeEvent, peekHeader, type EventHeader, type TeseliaEvent } from '@teselia/protocol';

import type { AppDb, EventKey, OutboxEntry } from '../storage/app-db.ts';

/** Largest sequence number: the field is an unsigned 32-bit integer (protocol §2). */
const MAX_SEQ = 0xffff_ffff;

/**
 * Stores a received event. Returns false if it was already in the log or is not an event at
 * all. Events of types this version does not know are kept: they are still valid to forward.
 */
export async function receiveEvent(
  db: AppDb,
  groupId: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const header = peekHeader(bytes);
  if (!header.ok) return false;
  const key: EventKey = [groupId, header.value.origin, header.value.seq];
  const tx = db.transaction('events', 'readwrite');
  if ((await tx.store.getKey(key)) !== undefined) {
    await tx.done;
    return false;
  }
  await tx.store.put({ groupId, origin: header.value.origin, seq: header.value.seq, bytes });
  await tx.done;
  return true;
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
  build: (header: EventHeader) => TeseliaEvent,
  header: Omit<EventHeader, 'seq'>,
): Promise<{ entry: OutboxEntry; bytes: Uint8Array }> {
  const tx = db.transaction(['sequence', 'events', 'outbox'], 'readwrite');
  const seq = (await tx.objectStore('sequence').get('next')) ?? 1;
  if (seq > MAX_SEQ) throw new RangeError('this device has used every sequence number');
  const encoded = encodeEvent(build({ ...header, seq }));
  if (!encoded.ok) {
    tx.abort();
    await tx.done.catch(() => undefined); // The abort itself rejects `done`.
    throw new Error(`cannot encode event: ${encoded.error.detail}`);
  }
  const entry: OutboxEntry = { groupId, origin: header.origin, seq };
  await Promise.all([
    tx.objectStore('sequence').put(seq + 1, 'next'),
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

/** Forgets everything a group left on this device. */
export async function deleteGroupEvents(db: AppDb, groupId: string): Promise<void> {
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  for (const name of ['events', 'outbox'] as const) {
    const store = tx.objectStore(name);
    for (const key of await store.index('byGroup').getAllKeys(groupId)) await store.delete(key);
  }
  await tx.objectStore('cursors').delete(groupId);
  await tx.done;
}
