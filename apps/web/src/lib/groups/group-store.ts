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

/** Records how much of a group's chat this device has shown, leaving the rest of it as it is. */
export async function setChatSeen(db: AppDb, id: string, seen: number): Promise<void> {
  const tx = db.transaction('groups', 'readwrite');
  const group = await tx.store.get(id);
  if (group) await tx.store.put({ ...group, chatSeen: seen });
  await tx.done;
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

/**
 * Remembers the group in use as a practice starts, kept on the device so that the app finds it
 * again even if it is closed during the practice.
 */
export async function rememberBeforePractice(db: AppDb, id: string | undefined): Promise<void> {
  if (id === undefined) await db.delete('settings', 'beforePractice');
  else await db.put('settings', id, 'beforePractice');
}

/** The group in use before the practice, forgotten once read: the practice is over. */
export async function takeBeforePractice(db: AppDb): Promise<string | undefined> {
  const tx = db.transaction('settings', 'readwrite');
  const stored = await tx.store.get('beforePractice');
  await tx.store.delete('beforePractice');
  await tx.done;
  return typeof stored === 'string' ? stored : undefined;
}
