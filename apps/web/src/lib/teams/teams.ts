// Teams as the app shows them (protocol §3.15): their colours, who is in which, whether a task is
// for this device through its team, and new team IDs.

import { teamOf, type GroupState } from '@tesel/core';
import type { NodeId, TeamColour, TeamEvent } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import type { Tone } from '../ui/theme.ts';

/** Each team colour as the app draws and names it, in the order new teams take them. */
export const TEAM_COLOURS: Readonly<
  Record<TeamColour, { readonly tone: Tone; readonly label: MessageKey }>
> = {
  blue: { tone: 'blue', label: 'colourBlue' },
  orange: { tone: 'orange', label: 'colourOrange' },
  teal: { tone: 'teal', label: 'colourTeal' },
  red: { tone: 'red', label: 'colourRed' },
  green: { tone: 'green', label: 'colourGreen' },
  black: { tone: 'ink', label: 'colourBlack' },
};

const COLOUR_ORDER = Object.keys(TEAM_COLOURS) as TeamColour[];

/** The teams in use, by name. */
export function activeTeams(teams: GroupState['teams']): TeamEvent[] {
  return [...teams.values()]
    .filter((team) => !team.dissolved)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether something for `assignee` is for this device: for it, or for its team. */
export function isFor(assignee: NodeId | null, self: NodeId, teams: GroupState['teams']): boolean {
  return assignee !== null && (assignee === self || assignee === teamOf(teams, self)?.team);
}

/** The colour a new team takes: the first no team uses, or else the first. */
export function nextColour(teams: GroupState['teams']): TeamColour {
  const used = new Set(activeTeams(teams).map((team) => team.colour));
  return COLOUR_ORDER.find((colour) => !used.has(colour)) ?? 'blue';
}

/**
 * A new team ID: 4 random bytes, never 00000000 and never the ID of a member or a team the group
 * knows (§3.15).
 */
export function newTeamId(state: Pick<GroupState, 'members' | 'teams'>): NodeId {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('') as NodeId;
    if (id !== '00000000' && !state.members.has(id) && !state.teams.has(id)) return id;
  }
}
