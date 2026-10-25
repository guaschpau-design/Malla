import 'fake-indexeddb/auto';

import type { NodeId } from '@malla/protocol';
import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { invitationFor } from './group.ts';
import { getActiveGroupId, listGroups } from './group-store.ts';
import { joinGroup, startGroup } from './membership.ts';

const ISSUER = 'a1b2c3d4' as NodeId;

let dbCounter = 0;
const freshDb = () => openAppDb(`membership-test-${String(dbCounter++)}`);

describe('membership', () => {
  it('makes a newly created group the active one', async () => {
    const db = await freshDb();
    const group = await startGroup(db, 'Rescate', 1000);
    expect(await getActiveGroupId(db)).toBe(group.id);
  });

  it('joins a group once even if the same invitation is opened twice', async () => {
    const coordinatorDb = await freshDb();
    const group = await startGroup(coordinatorDb, 'Rescate', 1000);
    const invitation = invitationFor(group, 'member', ISSUER);

    const memberDb = await freshDb();
    expect((await joinGroup(memberDb, invitation, 2000)).outcome).toBe('joined');
    expect((await joinGroup(memberDb, invitation, 3000)).outcome).toBe('already-member');
    const groups = await listGroups(memberDb);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.joinedAt).toBe(2000);
    expect(await getActiveGroupId(memberDb)).toBe(group.id);
  });
});
