// How far this device has read each group's envelopes on each relay (protocol §8.3).

import { serverBaseUrl } from '@teselia/protocol';

import type { AppDb } from '../storage/app-db.ts';

/** The stored cursor, or 0 if this device never synced the group through this relay. */
export async function loadCursor(db: AppDb, groupId: string, relay: string): Promise<number> {
  return (await db.get('cursors', [groupId, serverBaseUrl(relay)])) ?? 0;
}

export async function saveCursor(
  db: AppDb,
  groupId: string,
  relay: string,
  cursor: number,
): Promise<void> {
  await db.put('cursors', cursor, [groupId, serverBaseUrl(relay)]);
}

/** The key range of every cursor of a group. */
export function groupCursors(groupId: string): IDBKeyRange {
  return IDBKeyRange.bound([groupId], [groupId, []]);
}
