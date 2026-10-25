// Joining and creating groups: the steps that touch more than one record.

import type { Invitation } from '@malla/protocol';

import type { AppDb } from '../storage/app-db.ts';
import {
  applyInvitation,
  createGroup,
  groupId,
  type JoinOutcome,
  type StoredGroup,
} from './group.ts';
import { getGroup, saveGroup, setActiveGroupId } from './group-store.ts';

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
export async function startGroup(db: AppDb, name: string, now: number): Promise<StoredGroup> {
  const group = createGroup(name, now);
  await saveGroup(db, group);
  await setActiveGroupId(db, group.id);
  return group;
}
