// Joining, creating and leaving groups: the steps that touch more than one record.

import type { Invitation } from '@tesel/protocol';

import { deleteGroupEvents } from '../events/event-log.ts';
import type { AppDb } from '../storage/app-db.ts';
import {
  applyInvitation,
  createGroup,
  groupId,
  type JoinOutcome,
  type StoredGroup,
} from './group.ts';
import { deleteGroup, getGroup, saveGroup, setActiveGroupId } from './group-store.ts';

/** Joins (or re-joins) the group of an invitation and makes it the active group. */
export async function joinGroup(
  db: AppDb,
  invitation: Invitation,
  now: number,
): Promise<{ group: StoredGroup; outcome: JoinOutcome }> {
  const existing = await getGroup(db, groupId(invitation.secret));
  const result = applyInvitation(existing, invitation, now);
  await saveGroup(db, result.group);
  await setActiveGroupId(db, result.group.id);
  return result;
}

/** Creates a group coordinated by this device and makes it the active group. */
export async function startGroup(
  db: AppDb,
  name: string,
  server: string | null,
  now: number,
): Promise<StoredGroup> {
  const group = createGroup(name, server, now);
  await saveGroup(db, group);
  await setActiveGroupId(db, group.id);
  return group;
}

/**
 * Creates a practice group and makes it the active group: one without a server, whose other
 * members a practice run simulates on this device.
 */
export async function startPractice(db: AppDb, name: string, now: number): Promise<StoredGroup> {
  const group: StoredGroup = { ...createGroup(name, null, now), practice: true };
  await saveGroup(db, group);
  await setActiveGroupId(db, group.id);
  return group;
}

/** Forgets a group and everything it left on this device, including its secret. */
export async function leaveGroup(db: AppDb, id: string): Promise<void> {
  await deleteGroupEvents(db, id);
  await deleteGroup(db, id);
}
