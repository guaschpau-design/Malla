// How far this device has read each group's envelopes on the group's server.

import type { AppDb } from '../storage/app-db.ts';

/** The stored cursor, or 0 if none is stored for this server (a new server starts over). */
export async function loadCursor(db: AppDb, groupId: string, server: string): Promise<number> {
  const stored = await db.get('cursors', groupId);
  return stored?.server === server ? stored.cursor : 0;
}

export async function saveCursor(
  db: AppDb,
  groupId: string,
  server: string,
  cursor: number,
): Promise<void> {
  await db.put('cursors', { server, cursor }, groupId);
}
