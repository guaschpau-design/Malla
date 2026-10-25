import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { createGroup } from './group.ts';
import {
  deleteGroup,
  getActiveGroupId,
  getGroup,
  listGroups,
  saveGroup,
  setActiveGroupId,
} from './group-store.ts';

let dbCounter = 0;
const freshDb = () => openAppDb(`groups-test-${String(dbCounter++)}`);

describe('group store', () => {
  it('lists groups in the order they were joined', async () => {
    const db = await freshDb();
    const later = createGroup('Later', 2000);
    const earlier = createGroup('Earlier', 1000);
    await saveGroup(db, later);
    await saveGroup(db, earlier);
    expect((await listGroups(db)).map((g) => g.name)).toEqual(['Earlier', 'Later']);
    expect(await getGroup(db, later.id)).toEqual(later);
  });

  it('clears the active group when it is deleted', async () => {
    const db = await freshDb();
    const kept = createGroup('Kept', 1000);
    const removed = createGroup('Removed', 2000);
    await saveGroup(db, kept);
    await saveGroup(db, removed);

    await setActiveGroupId(db, kept.id);
    await deleteGroup(db, removed.id);
    expect(await getActiveGroupId(db)).toBe(kept.id);

    await deleteGroup(db, kept.id);
    expect(await getActiveGroupId(db)).toBeUndefined();
    expect(await listGroups(db)).toEqual([]);
  });
});
