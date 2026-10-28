import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { groupCursors, loadPosition, savePosition, START } from './cursor-store.ts';

const at = (cursor: number, store: string | null = 'store-a') => ({ cursor, store });

describe('sync cursors', () => {
  it('keeps one position per relay, so moving to a command post and back loses nothing', async () => {
    const db = await openAppDb('cursor-test');
    expect(await loadPosition(db, 'group', 'https://one.example/')).toEqual(START);
    await savePosition(db, 'group', 'https://one.example', at(12));
    await savePosition(db, 'group', 'https://post.example/', at(3, 'store-b'));
    expect(await loadPosition(db, 'group', 'https://one.example/')).toEqual(at(12));
    expect(await loadPosition(db, 'group', 'https://post.example')).toEqual(at(3, 'store-b'));
    expect(await loadPosition(db, 'other', 'https://one.example/')).toEqual(START);
  });

  it('finds every position of a group and no other', async () => {
    const db = await openAppDb('cursor-range-test');
    await savePosition(db, 'group', 'https://one.example/', at(1));
    await savePosition(db, 'group', 'https://two.example/', at(2));
    await savePosition(db, 'group2', 'https://one.example/', at(3));
    expect(await db.getAll('cursors', groupCursors('group'))).toEqual([at(1), at(2)]);
  });
});
