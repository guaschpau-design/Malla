import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

import { openAppDb } from './app-db.ts';

describe('app database', () => {
  it('upgrades a version 1 database to the current one without losing its groups', async () => {
    const v1 = await openDB('upgrade-test', 1, {
      upgrade(database) {
        database.createObjectStore('identity');
        database.createObjectStore('groups', { keyPath: 'id' });
        database.createObjectStore('settings');
      },
    });
    await v1.put('groups', { id: 'g1', name: 'Rescate' });
    v1.close();

    const db = await openAppDb('upgrade-test');
    expect(await db.get('groups', 'g1')).toMatchObject({ name: 'Rescate' });
    expect([...db.objectStoreNames].sort()).toEqual([
      'cursors',
      'events',
      'groups',
      'identity',
      'outbox',
      'radioTexts',
      'sequence',
      'servers',
      'settings',
      'weather',
    ]);
  });
});
