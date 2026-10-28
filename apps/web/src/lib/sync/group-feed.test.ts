import 'fake-indexeddb/auto';

import { TRAIL_POINTS } from '@tesel/core';
import {
  deriveGroupKeys,
  encodeEvent,
  encodeLogFile,
  sealEnvelope,
  type NodeId,
  type TeselEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { loadEvents, receiveEvents } from '../events/event-log.ts';
import { createGroup } from '../groups/group.ts';
import { createLocalIdentity } from '../identity/identity.ts';
import { openAppDb } from '../storage/app-db.ts';
import { GroupFeed } from './group-feed.svelte.ts';

const MEMBERS = ['0a0a0a0a', '0b0b0b0b', '0c0c0c0c'] as NodeId[];
const T0 = 1_761_350_400;
/** More positions per member than a trail shows. */
const POSITIONS = TRAIL_POINTS + 140;

/** Every member shares their position every ten seconds, and says something once. */
function operation(): TeselEvent[] {
  return MEMBERS.flatMap((origin): TeselEvent[] => [
    ...Array.from({ length: POSITIONS }, (_, i) => ({
      type: 'position' as const,
      origin,
      seq: i + 1,
      time: T0 + 10 * i,
      lat: 39.47,
      lon: -0.37,
      accuracy: 5,
      heading: null,
      speed: null,
    })),
    { type: 'chat', origin, seq: POSITIONS + 1, time: T0, text: 'En posición' },
  ]);
}

function bytesOf(events: readonly TeselEvent[]): Uint8Array[] {
  return events.map((event) => {
    const encoded = encodeEvent(event);
    if (!encoded.ok) throw new Error(encoded.error.detail);
    return encoded.value;
  });
}

let databases = 0;

async function setUp() {
  const db = await openAppDb(`group-feed-${String(++databases)}`);
  const group = createGroup('Rescate', null, Date.now());
  const identity = createLocalIdentity('Ana', Date.now());
  return { db, group, identity };
}

/** Positions kept: each member's trail. Chat, and this device's announcement, are kept too. */
const KEPT = MEMBERS.length * (TRAIL_POINTS + 1) + 1;

describe('a group feed', () => {
  it('forgets the positions its trails have outlived, and does not take them back', async () => {
    const { db, group, identity } = await setUp();
    const feed = await GroupFeed.open(db, group, identity);
    const keys = deriveGroupKeys(group.secret);
    const file = encodeLogFile({
      groupId: keys.groupId,
      envelopes: bytesOf(operation()).map((bytes) => sealEnvelope(keys, bytes)),
    });

    const first = await feed.importLog(file);
    expect(await loadEvents(db, group.id)).toHaveLength(KEPT);
    expect(first.kind === 'loaded' && first.added).toBe(MEMBERS.length * (POSITIONS + 1));
    for (const member of MEMBERS) {
      expect(feed.state.trails.get(member)?.points).toHaveLength(TRAIL_POINTS);
    }

    // The same file again, as a relay or a second device would bring it: nothing is new.
    const again = await feed.importLog(file);
    expect(again.kind === 'loaded' && again.added).toBe(0);
    expect(await loadEvents(db, group.id)).toHaveLength(KEPT);
  });

  it('forgets what a log written before forgetting holds, when the group opens', async () => {
    const { db, group, identity } = await setUp();
    await receiveEvents(db, group.id, bytesOf(operation()));
    expect(await loadEvents(db, group.id)).toHaveLength(MEMBERS.length * (POSITIONS + 1));

    const feed = await GroupFeed.open(db, group, identity);
    expect(await loadEvents(db, group.id)).toHaveLength(KEPT);
    expect(feed.state.chat).toHaveLength(MEMBERS.length);
  });
});
