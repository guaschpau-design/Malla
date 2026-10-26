// Persistence of groups and of which one is active.

import type { AppDb } from '../storage/app-db.ts';
import type { StoredGroup } from './group.ts';

export async function listGroups(db: AppDb): Promise<StoredGroup[]> {
  const groups = await db.getAll('groups');
  return groups.sort((a, b) => a.joinedAt - b.joinedAt);
}

export async function getGroup(db: AppDb, id: string): Promise<StoredGroup | undefined> {
  return db.get('groups', id);
}

export async function saveGroup(db: AppDb, group: StoredGroup): Promise<void> {
  await db.put('groups', group);
}

/** Forgets a group. If it was active, no group is active afterwards. */
export async function deleteGroup(db: AppDb, id: string): Promise<void> {
  const tx = db.transaction(['groups', 'settings'], 'readwrite');
  await tx.objectStore('groups').delete(id);
  if ((await tx.objectStore('settings').get('activeGroupId')) === id) {
    await tx.objectStore('settings').delete('activeGroupId');
  }
  await tx.done;
}

export async function getActiveGroupId(db: AppDb): Promise<string | undefined> {
  const stored = await db.get('settings', 'activeGroupId');
  return typeof stored === 'string' ? stored : undefined;
}

export async function setActiveGroupId(db: AppDb, id: string): Promise<void> {
  await db.put('settings', id, 'activeGroupId');
}
