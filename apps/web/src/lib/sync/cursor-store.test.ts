import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadCursor, saveCursor } from './cursor-store.ts';

describe('sync cursors', () => {
  it('starts over when the group moves to another server', async () => {
    const db = await openAppDb('cursor-test');
    expect(await loadCursor(db, 'group', 'https://one.example/')).toBe(0);
    await saveCursor(db, 'group', 'https://one.example/', 12);
    expect(await loadCursor(db, 'group', 'https://one.example/')).toBe(12);
    expect(await loadCursor(db, 'group', 'https://two.example/')).toBe(0);
  });
});
