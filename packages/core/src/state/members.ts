// Who is in the group: the latest MEMBER_INFO of each member (§3.3).

import type { MemberInfoEvent, NodeId } from '@tesel/protocol';

import { keepNewest } from '../collections.ts';
import { defineSlice } from './slice.ts';

export const members = defineSlice({
  handles: ['member-info'],
  empty: new Map() as ReadonlyMap<NodeId, MemberInfoEvent>,
  apply: (state, event) => keepNewest(state, event.origin, event),
});
