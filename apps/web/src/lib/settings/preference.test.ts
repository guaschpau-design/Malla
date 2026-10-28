import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { flag, subset } from './preference.svelte.ts';
import { loadPreferences } from './preferences.ts';

let databases = 0;
const freshDb = () => openAppDb(`preference-test-${String(++databases)}`);

describe('preferences', () => {
  it('falls back to the default until set, and remembers what is set', async () => {
    const db = await freshDb();
    const format = (await loadPreferences(db)).coordinateFormat;
    expect(format.value).toBe('decimal');
    await format.set('utm');
    expect(format.value).toBe('utm');
    expect((await loadPreferences(db)).coordinateFormat.value).toBe('utm');
  });

  it('ignores stored values that are no longer valid', async () => {
    const db = await freshDb();
    await db.put('settings', 'gars', 'coordinateFormat');
    expect((await loadPreferences(db)).coordinateFormat.value).toBe('decimal');
    expect(flag('coordinateFormat', true).read('yes')).toBeUndefined();
    expect(subset('coordinateFormat', ['a', 'b'], []).read(['b', 'z'])).toEqual(['b']);
  });
});
