// What to call a member: their alias, or their node ID until their MEMBER_INFO arrives.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';

export function aliasOf(state: Pick<GroupState, 'members'>, id: NodeId): string {
  return state.members.get(id)?.alias ?? id;
}
