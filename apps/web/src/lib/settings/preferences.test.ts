import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadPreferences } from './preferences.ts';

describe('the preferences of this device', () => {
  it('keep the grid switched on by a version that stored it under its former name', async () => {
    const db = await openAppDb('preferences-test-renamed');
    await db.put('settings', true, 'mgrsGrid');
    expect((await loadPreferences(db)).grid.value).toBe(true);
    expect(await db.get('settings', 'grid')).toBe(true);
    expect(await db.get('settings', 'mgrsGrid')).toBeUndefined();
  });
});
