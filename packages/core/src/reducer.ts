// The current picture of a group, derived from its events (ARCHITECTURE.md §3.4, ADR-0003).
//
// `reduce` is idempotent and order-independent: applying the same events in any order, any
// number of times, gives the same state. Events arrive late, twice or out of order through
// several transports, and this property is what makes that harmless.

import {
  eventRefKey,
  type AckEvent,
  type AlertEvent,
  type ChatEvent,
  type MarkerEvent,
  type MemberInfoEvent,
  type NodeId,
  type ObjectDeleteEvent,
  type PositionEvent,
  type PositionHiddenEvent,
  type ShapeEvent,
  type SosCancelEvent,
  type SosEvent,
  type TeselEvent,
} from '@tesel/protocol';

import { insertOrdered, keepNewest, keepOldest } from './collections.ts';

/** The latest event about a map object; OBJECT_DELETE means the object is gone (§3.10). */
export type ObjectRecord = MarkerEvent | ShapeEvent | ObjectDeleteEvent;

export interface GroupState {
  /** Latest MEMBER_INFO of each member. */
  readonly members: ReadonlyMap<NodeId, MemberInfoEvent>;
  /** Latest position report of each member; POSITION_HIDDEN means "not sharing". */
  readonly positions: ReadonlyMap<NodeId, PositionEvent | PositionHiddenEvent>;
  /** Chat lines in (time, origin, seq) order, without duplicates. */
  readonly chat: readonly ChatEvent[];
  /** Latest event of each map object, by object reference key. Deletions are kept (§3.10). */
  readonly objects: ReadonlyMap<string, ObjectRecord>;
  /** Every SOS, by event reference key. */
  readonly sos: ReadonlyMap<string, SosEvent>;
  /** The first cancellation of each SOS, by the SOS's reference key. */
  readonly sosCancels: ReadonlyMap<string, SosCancelEvent>;
  /** Alerts in (time, origin, seq) order. */
  readonly alerts: readonly AlertEvent[];
  /** Acknowledgements: target reference key → member → their first ACK. */
  readonly acks: ReadonlyMap<string, ReadonlyMap<NodeId, AckEvent>>;
}

export const EMPTY_STATE: GroupState = {
  members: new Map(),
  positions: new Map(),
  chat: [],
  objects: new Map(),
  sos: new Map(),
  sosCancels: new Map(),
  alerts: [],
  acks: new Map(),
};

/** The state after one more event. Returns `state` itself when nothing changes. */
export function reduce(state: GroupState, event: TeselEvent): GroupState {
  switch (event.type) {
    case 'member-info':
      return update(state, 'members', keepNewest(state.members, event.origin, event));
    case 'position':
    case 'position-hidden':
      return update(state, 'positions', keepNewest(state.positions, event.origin, event));
    case 'chat':
      return update(state, 'chat', insertOrdered(state.chat, event));
    case 'marker':
    case 'shape':
    case 'object-delete':
      return update(state, 'objects', keepNewest(state.objects, eventRefKey(event.object), event));
    case 'sos':
      return update(state, 'sos', keepOldest(state.sos, eventRefKey(event), event));
    case 'sos-cancel':
      return update(
        state,
        'sosCancels',
        keepOldest(state.sosCancels, eventRefKey(event.sos), event),
      );
    case 'alert':
      return update(state, 'alerts', insertOrdered(state.alerts, event));
    case 'ack':
      return update(state, 'acks', addAck(state.acks, event));
  }
}

/** The state of a set of events, in any order. */
export function stateOf(events: Iterable<TeselEvent>): GroupState {
  let state = EMPTY_STATE;
  for (const event of events) state = reduce(state, event);
  return state;
}

function update<K extends keyof GroupState>(
  state: GroupState,
  key: K,
  value: GroupState[K],
): GroupState {
  return value === state[key] ? state : { ...state, [key]: value };
}

function addAck(acks: GroupState['acks'], event: AckEvent): GroupState['acks'] {
  const target = eventRefKey(event.target);
  const current = acks.get(target) ?? new Map<NodeId, AckEvent>();
  const updated = keepOldest(current, event.origin, event);
  return updated === current ? acks : new Map(acks).set(target, updated);
}
