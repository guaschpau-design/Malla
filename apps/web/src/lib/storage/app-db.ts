// The app's own IndexedDB database: identity, groups, settings and each group's event log.
// Map tiles live in a separate database (map/tile-store.ts) so they can be cleared without
// touching anything else.

import type { NodeId, ServerInfo } from '@tesel/protocol';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import type { StoredRadioText } from '../radio/radio-texts.ts';

/** An event of a group as received or created: its encoded bytes, keyed by group and ref. */
export interface StoredEvent extends OutboxEntry {
  readonly bytes: Uint8Array;
}

/** An own event the group's server has not confirmed storing yet (protocol §8). */
export interface OutboxEntry {
  readonly groupId: string;
  readonly origin: NodeId;
  readonly seq: number;
}

export type SettingKey =
  'activeGroupId' | 'positionMode' | 'coordinateFormat' | 'hiddenLayers' | 'keepScreenOn';

export type EventKey = [groupId: string, origin: NodeId, seq: number];

/** A group and a relay it syncs through: the group's server or a command post (protocol §8.3). */
export type CursorKey = [groupId: string, relay: string];

export interface AppSchema extends DBSchema {
  /** A single record under the key `self`. */
  identity: { key: 'self'; value: LocalIdentity };
  groups: { key: string; value: StoredGroup };
  /** The active group and the preferences of this device (settings/preferences.ts). */
  settings: { key: SettingKey; value: unknown };
  /** The next sequence number this device will use (ARCHITECTURE.md §3.3). */
  sequence: { key: 'next'; value: number };
  events: { key: EventKey; value: StoredEvent; indexes: { byGroup: string } };
  outbox: { key: EventKey; value: OutboxEntry; indexes: { byGroup: string } };
  /** How far this device has read each group's envelopes on each relay. */
  cursors: { key: CursorKey; value: number };
  /** What each server last said about itself, by server base URL (protocol §8.1). */
  servers: { key: string; value: ServerInfo };
  /** Text messages of other MeshCore apps heard by the radio, oldest first. */
  radioTexts: { key: number; value: StoredRadioText };
}

export type AppDb = IDBPDatabase<AppSchema>;

const DB_NAME = 'tesel';
const DB_VERSION = 4;

export function openAppDb(name: string = DB_NAME): Promise<AppDb> {
  return openDB<AppSchema>(name, DB_VERSION, {
    upgrade(database, oldVersion) {
      // Each step upgrades from the previous version; a new install runs all of them.
      if (oldVersion < 1) {
        database.createObjectStore('identity');
        database.createObjectStore('groups', { keyPath: 'id' });
        database.createObjectStore('settings');
      }
      if (oldVersion < 2) {
        database.createObjectStore('sequence');
        const events = database.createObjectStore('events', {
          keyPath: ['groupId', 'origin', 'seq'],
        });
        events.createIndex('byGroup', 'groupId');
        const outbox = database.createObjectStore('outbox', {
          keyPath: ['groupId', 'origin', 'seq'],
        });
        outbox.createIndex('byGroup', 'groupId');
        database.createObjectStore('cursors');
      }
      if (oldVersion < 3) {
        database.createObjectStore('radioTexts', { autoIncrement: true });
      }
      if (oldVersion < 4) {
        // Cursors are now kept per relay; old ones are dropped and the backlog fetched again.
        database.deleteObjectStore('cursors');
        database.createObjectStore('cursors');
        database.createObjectStore('servers');
      }
    },
  });
}
