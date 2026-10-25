import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { groupCursors, loadCursor, saveCursor } from './cursor-store.ts';

describe('sync cursors', () => {
  it('keeps one cursor per relay, so moving to a command post and back loses nothing', async () => {
    const db = await openAppDb('cursor-test');
    expect(await loadCursor(db, 'group', 'https://one.example/')).toBe(0);
    await saveCursor(db, 'group', 'https://one.example', 12);
    await saveCursor(db, 'group', 'https://post.example/', 3);
    expect(await loadCursor(db, 'group', 'https://one.example/')).toBe(12);
    expect(await loadCursor(db, 'group', 'https://post.example')).toBe(3);
    expect(await loadCursor(db, 'other', 'https://one.example/')).toBe(0);
  });

  it('finds every cursor of a group and no other', async () => {
    const db = await openAppDb('cursor-range-test');
    await saveCursor(db, 'group', 'https://one.example/', 1);
    await saveCursor(db, 'group', 'https://two.example/', 2);
    await saveCursor(db, 'group2', 'https://one.example/', 3);
    expect(await db.getAll('cursors', groupCursors('group'))).toEqual([1, 2]);
  });
});
