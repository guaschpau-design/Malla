import 'fake-indexeddb/auto';

import { decodeEvent, encodeEvent, type NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadCursor } from '../sync/cursor-store.ts';
import {
  confirmStored,
  deleteGroupEvents,
  loadEvents,
  pendingEvents,
  publishEvent,
  receiveEvents,
} from './event-log.ts';

const ME = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
let dbCounter = 0;
const freshDb = () => openAppDb(`event-log-test-${String(dbCounter++)}`);

const chatBytes = (origin: NodeId, seq: number, text: string) => {
  const encoded = encodeEvent({ type: 'chat', origin, seq, time: 1000, text });
  if (!encoded.ok) throw new Error('encode');
  return encoded.value;
};

describe('event log', () => {
  it('numbers own events from 1 across every group, and never reuses a number', async () => {
    const db = await freshDb();
    const build = (text: string) => (header: { origin: NodeId; seq: number; time: number }) =>
      ({ ...header, type: 'chat', text }) as const;
    const a = await publishEvent(db, 'group-a', build('uno'), { origin: ME, time: 1000 });
    const b = await publishEvent(db, 'group-b', build('dos'), { origin: ME, time: 1001 });
    expect([a.entry.seq, b.entry.seq]).toEqual([1, 2]);
    db.close();
    const reopened = await openAppDb(db.name);
    const c = await publishEvent(reopened, 'group-a', build('tres'), { origin: ME, time: 1002 });
    expect(c.entry.seq).toBe(3);
  });

  it('keeps own events in the outbox until the server stores them', async () => {
    const db = await freshDb();
    const { entry } = await publishEvent(
      db,
      'group',
      (header) => ({ ...header, type: 'chat', text: 'hola' }),
      { origin: ME, time: 1000 },
    );
    const pending = await pendingEvents(db, 'group');
    expect(pending.map((p) => p.entry)).toEqual([entry]);
    expect(decodeEvent(pending[0]?.bytes ?? new Uint8Array()).ok).toBe(true);
    await confirmStored(db, entry);
    expect(await pendingEvents(db, 'group')).toEqual([]);
    expect(await loadEvents(db, 'group')).toHaveLength(1);
  });

  it('stores a received event once, whichever transport brings it again', async () => {
    const db = await freshDb();
    const bytes = chatBytes(OTHER, 4, 'hola');
    const entry = { groupId: 'group', origin: OTHER, seq: 4 };
    expect(await receiveEvents(db, 'group', [bytes])).toEqual([{ entry, bytes }]);
    expect(await receiveEvents(db, 'group', [bytes, new Uint8Array([1, 2, 3])])).toEqual([]);
    expect(await loadEvents(db, 'group')).toEqual([bytes]);
    expect(await pendingEvents(db, 'group')).toEqual([]);
  });

  it('stores a batch in order, skipping what repeats within it', async () => {
    const db = await freshDb();
    const first = chatBytes(OTHER, 1, 'uno');
    const second = chatBytes(OTHER, 2, 'dos');
    const received = await receiveEvents(db, 'group', [first, second, first]);
    expect(received.map((r) => r.bytes)).toEqual([first, second]);
    expect(await loadEvents(db, 'group')).toHaveLength(2);
  });

  it('saves how far a relay was read together with the events read', async () => {
    const db = await freshDb();
    const relay = 'https://tesel.example/';
    await receiveEvents(db, 'group', [chatBytes(OTHER, 1, 'a')], { readTo: { relay, cursor: 42 } });
    expect(await loadCursor(db, 'group', relay)).toBe(42);
  });

  it('queues an event heard over the radio for the server when bridging', async () => {
    const db = await freshDb();
    const bytes = chatBytes(OTHER, 7, 'por radio');
    const [received] = await receiveEvents(db, 'group', [bytes], { forward: true });
    expect(await pendingEvents(db, 'group')).toEqual([received]);
  });

  it('refuses an event that does not fit the protocol, without using a sequence number', async () => {
    const db = await freshDb();
    await expect(
      publishEvent(db, 'group', (header) => ({ ...header, type: 'chat', text: 'x'.repeat(500) }), {
        origin: ME,
        time: 1000,
      }),
    ).rejects.toThrow(/encode/);
    const next = await publishEvent(
      db,
      'group',
      (header) => ({ ...header, type: 'chat', text: 'ok' }),
      { origin: ME, time: 1000 },
    );
    expect(next.entry.seq).toBe(1);
  });

  it('forgets everything a group left behind', async () => {
    const db = await freshDb();
    await receiveEvents(db, 'gone', [chatBytes(OTHER, 1, 'a')]);
    await receiveEvents(db, 'kept', [chatBytes(OTHER, 2, 'b')]);
    await deleteGroupEvents(db, 'gone');
    expect(await loadEvents(db, 'gone')).toEqual([]);
    expect(await loadEvents(db, 'kept')).toHaveLength(1);
  });
});
