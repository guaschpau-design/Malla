// How the group is split for the work: the latest TEAM of each team (§3.15), and the team each
// member is in.

import type { NodeId, TeamEvent } from '@tesel/protocol';

import { keepNewest } from '../collections.ts';
import { compareEvents } from '../ordering.ts';
import { defineSlice } from './slice.ts';

export const teams = defineSlice({
  handles: ['team'],
  empty: new Map() as ReadonlyMap<NodeId, TeamEvent>,
  apply: (state, event) => keepNewest(state, event.team, event),
});

/** The team a member is in: of the teams that list them, the newest (§3.15); null if none. */
export function teamOf(state: ReadonlyMap<NodeId, TeamEvent>, member: NodeId): TeamEvent | null {
  let found: TeamEvent | null = null;
  for (const team of state.values()) {
    if (team.dissolved || !team.members.includes(member)) continue;
    if (found === null || compareEvents(team, found) > 0) found = team;
  }
  return found;
}
