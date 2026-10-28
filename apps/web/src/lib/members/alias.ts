// What to call a member: their alias, or their node ID until their MEMBER_INFO arrives; and what
// to call whoever a task is for, a member or a team.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';

export function aliasOf(state: Pick<GroupState, 'members'>, id: NodeId): string {
  return state.members.get(id)?.alias ?? id;
}

/** A team by its name (protocol §3.15), a member by their alias. */
export function nameOf(state: Pick<GroupState, 'members' | 'teams'>, id: NodeId): string {
  return state.teams.get(id)?.name ?? aliasOf(state, id);
}
