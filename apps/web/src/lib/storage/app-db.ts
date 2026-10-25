// The app's own IndexedDB database: identity, groups and settings. Map tiles live in a separate
// database (map/tile-store.ts) so they can be cleared without touching anything else.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';

export interface AppSchema extends DBSchema {
  /** A single record under the key `self`. */
  identity: { key: 'self'; value: LocalIdentity };
  groups: { key: string; value: StoredGroup };
  settings: { key: 'activeGroupId'; value: string };
}

export type AppDb = IDBPDatabase<AppSchema>;

const DB_NAME = 'malla';
const DB_VERSION = 1;

export function openAppDb(name: string = DB_NAME): Promise<AppDb> {
  return openDB<AppSchema>(name, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('identity');
      database.createObjectStore('groups', { keyPath: 'id' });
      database.createObjectStore('settings');
    },
  });
}
