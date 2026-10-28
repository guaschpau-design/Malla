// Who is in the group: the latest MEMBER_INFO of each member (§3.3), and the latest MEMBER_STATE
// of each, what the team needs to know about them (§3.14).

import type { MemberInfoEvent, MemberStateEvent, NodeId } from '@tesel/protocol';

import { keepNewest } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const members = defineSlice({
  handles: ['member-info'],
  empty: new Map() as ReadonlyMap<NodeId, MemberInfoEvent>,
  apply: (state, event) => keepNewest(state, event.origin, event),
});

export const memberStates = defineSlice({
  handles: ['member-state'],
  empty: new Map() as ReadonlyMap<NodeId, MemberStateEvent>,
  apply: (state, event) => keepNewest(state, event.origin, event),
});
