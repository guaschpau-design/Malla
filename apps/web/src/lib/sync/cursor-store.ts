// How far this device has read each group's envelopes on each relay, and in which of the relay's
// stores (protocol §8, §8.3).

import { serverBaseUrl } from '@tesel/protocol';

import type { AppDb } from '../storage/app-db.ts';
import type { RelayPosition } from './relay-client.ts';

/** Where a group starts on a relay it never synced through. */
export const START: RelayPosition = { cursor: 0, store: null };

/** The stored position, or the start if this device never synced the group through this relay. */
export async function loadPosition(
  db: AppDb,
  groupId: string,
  relay: string,
): Promise<RelayPosition> {
  return (await db.get('cursors', cursorKey(groupId, relay))) ?? START;
}

export async function savePosition(
  db: AppDb,
  groupId: string,
  relay: string,
  position: RelayPosition,
): Promise<void> {
  await db.put('cursors', position, cursorKey(groupId, relay));
}

/** Where the position of a group on a relay is stored: one per server, whatever its address form. */
export function cursorKey(groupId: string, relay: string): [string, string] {
  return [groupId, serverBaseUrl(relay)];
}

/** The key range of every position of a group. */
export function groupCursors(groupId: string): IDBKeyRange {
  return IDBKeyRange.bound([groupId], [groupId, []]);
}
