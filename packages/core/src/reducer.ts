// The current picture of a group, derived from its events (ARCHITECTURE.md §3.4, ADR-0003).
//
// `reduce` is idempotent and order-independent: applying the same events in any order, any
// number of times, gives the same state. Events arrive late, twice or out of order through
// several transports, and this property is what makes that harmless.

import type {
  ChatEvent,
  MallaEvent,
  MemberInfoEvent,
  NodeId,
  PositionEvent,
  PositionHiddenEvent,
} from '@malla/protocol';

import { compareEvents, newerOf } from './ordering.ts';

export interface GroupState {
  /** Latest MEMBER_INFO of each member. */
  readonly members: ReadonlyMap<NodeId, MemberInfoEvent>;
  /** Latest position report of each member; POSITION_HIDDEN means "not sharing". */
  readonly positions: ReadonlyMap<NodeId, PositionEvent | PositionHiddenEvent>;
  /** Chat lines in (time, origin, seq) order, without duplicates. */
  readonly chat: readonly ChatEvent[];
}

export const EMPTY_STATE: GroupState = { members: new Map(), positions: new Map(), chat: [] };

/** The state after one more event. Returns `state` itself when nothing changes. */
export function reduce(state: GroupState, event: MallaEvent): GroupState {
  switch (event.type) {
    case 'member-info': {
      const members = latestPerOrigin(state.members, event);
      return members === state.members ? state : { ...state, members };
    }
    case 'position':
    case 'position-hidden': {
      const positions = latestPerOrigin(state.positions, event);
      return positions === state.positions ? state : { ...state, positions };
    }
    case 'chat': {
      const chat = insertOrdered(state.chat, event);
      return chat === state.chat ? state : { ...state, chat };
    }
    // Map objects, SOS, alerts and acknowledgements are not part of the picture yet.
    case 'marker':
    case 'shape':
    case 'object-delete':
    case 'sos':
    case 'sos-cancel':
    case 'alert':
    case 'ack':
      return state;
  }
}

/** The state of a set of events, in any order. */
export function stateOf(events: Iterable<MallaEvent>): GroupState {
  let state = EMPTY_STATE;
  for (const event of events) state = reduce(state, event);
  return state;
}

function latestPerOrigin<T extends MallaEvent>(
  current: ReadonlyMap<NodeId, T>,
  event: T,
): ReadonlyMap<NodeId, T> {
  const known = current.get(event.origin);
  if (known !== undefined && newerOf(known, event) === known) return current;
  return new Map(current).set(event.origin, event);
}

/** Inserts keeping order; an event already present (same origin and seq) changes nothing. */
function insertOrdered<T extends MallaEvent>(list: readonly T[], event: T): readonly T[] {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = list[middle];
    if (item === undefined || compareEvents(item, event) >= 0) high = middle;
    else low = middle + 1;
  }
  const atPosition = list[low];
  if (atPosition !== undefined && isSameEvent(atPosition, event)) return list;
  return [...list.slice(0, low), event, ...list.slice(low)];
}

function isSameEvent(a: MallaEvent, b: MallaEvent): boolean {
  return a.origin === b.origin && a.seq === b.seq;
}
