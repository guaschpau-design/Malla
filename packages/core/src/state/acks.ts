// Who has seen what: per acknowledged event, the first ACK of each member (§3.2). SOS calls and
// alerts read it to show who has received them.

import { eventRefKey, type AckEvent, type NodeId } from '@tesel/protocol';

import { keepOldest } from '../collections.ts';
import { defineSlice } from './slice.ts';

type Acks = ReadonlyMap<string, ReadonlyMap<NodeId, AckEvent>>;

/** Target reference key → member → their first ACK. */
export const acks = defineSlice({
  handles: ['ack'],
  empty: new Map() as Acks,
  apply(state, event): Acks {
    const target = eventRefKey(event.target);
    const current = state.get(target) ?? new Map<NodeId, AckEvent>();
    const updated = keepOldest(current, event.origin, event);
    return updated === current ? state : new Map(state).set(target, updated);
  },
});
