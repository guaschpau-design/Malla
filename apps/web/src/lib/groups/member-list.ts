// The members of a group as the panel lists them.

import type { GroupState } from '@tesel/core';
import type { NodeId, Role } from '@tesel/protocol';

import { STALE_AFTER_S } from '../map/member-features.ts';

export type PositionStatus = 'live' | 'stale' | 'hidden' | 'never';

export interface MemberRow {
  readonly id: NodeId;
  readonly alias: string;
  /** Null for a member whose MEMBER_INFO has not arrived yet. */
  readonly role: Role | null;
  readonly self: boolean;
  readonly position: PositionStatus;
}

/** Everyone the group has heard from, this device first, then by alias. */
export function memberRows(state: GroupState, self: NodeId, now: number): MemberRow[] {
  const ids = new Set<NodeId>([...state.members.keys(), ...state.positions.keys()]);
  const rows = [...ids].map((id): MemberRow => {
    const info = state.members.get(id);
    const report = state.positions.get(id);
    let position: PositionStatus = 'never';
    if (report?.type === 'position-hidden') position = 'hidden';
    else if (report) position = now - report.time > STALE_AFTER_S ? 'stale' : 'live';
    return { id, alias: info?.alias ?? id, role: info?.role ?? null, self: id === self, position };
  });
  return rows.sort((a, b) => Number(b.self) - Number(a.self) || a.alias.localeCompare(b.alias));
}
