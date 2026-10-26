// The current picture of a group, derived from its events (ARCHITECTURE.md §3.4, ADR-0003).
//
// The state is composed of slices, one per domain, in ./state/. `reduce` is idempotent and
// order-independent: applying the same events in any order, any number of times, gives the same
// state. Events arrive late, twice or out of order through several transports, and this property
// is what makes that harmless.

import type { EventType, TeselEvent } from '@tesel/protocol';

import { acks } from './state/acks.ts';
import { journal } from './state/journal.ts';
import { members } from './state/members.ts';
import { alerts, chat } from './state/messages.ts';
import { objects } from './state/objects.ts';
import { positions } from './state/positions.ts';
import type { Slice } from './state/slice.ts';
import { sos, sosCancels } from './state/sos.ts';
import { tasks } from './state/tasks.ts';
import { trails } from './state/trails.ts';

export type { ObjectRecord } from './state/objects.ts';
export type { JournalEvent } from './state/journal.ts';
export type { Trail } from './state/trails.ts';

/** Every slice of the group state, by its name in the state. */
const SLICES = {
  members,
  positions,
  trails,
  chat,
  objects,
  sos,
  sosCancels,
  alerts,
  acks,
  tasks,
  journal,
};

type SliceName = keyof typeof SLICES;

export type GroupState = { readonly [K in SliceName]: (typeof SLICES)[K]['empty'] };

const SLICE_NAMES = Object.keys(SLICES) as SliceName[];

export const EMPTY_STATE: GroupState = Object.fromEntries(
  SLICE_NAMES.map((name) => [name, SLICES[name].empty]),
) as GroupState;

/** Which slices read each event type. Types no slice reads (or unknown ones) change nothing. */
const READERS: ReadonlyMap<EventType, readonly SliceName[]> = (() => {
  const readers = new Map<EventType, SliceName[]>();
  for (const name of SLICE_NAMES) {
    for (const type of SLICES[name].handles) {
      readers.set(type, [...(readers.get(type) ?? []), name]);
    }
  }
  return readers;
})();

/** Event types some slice reads, for the test that keeps every known type covered. */
export const HANDLED_TYPES: ReadonlySet<EventType> = new Set(READERS.keys());

/** The state after one more event. Returns `state` itself when nothing changes. */
export function reduce(state: GroupState, event: TeselEvent): GroupState {
  let next = state;
  for (const name of READERS.get(event.type) ?? []) {
    const value = applySlice(name, next[name], event);
    if (value !== next[name]) next = { ...next, [name]: value };
  }
  return next;
}

/** The state after several more events, in any order: what a device does with a batch. */
export function reduceAll(state: GroupState, events: Iterable<TeselEvent>): GroupState {
  let next = state;
  for (const event of events) next = reduce(next, event);
  return next;
}

/** The state of a set of events, in any order. */
export function stateOf(events: Iterable<TeselEvent>): GroupState {
  return reduceAll(EMPTY_STATE, events);
}

// The one place where a slice is widened to any event and any state. It is safe: READERS only
// routes to a slice the event types it declared, and each state field holds that slice's own
// state. TypeScript cannot follow that correlation through a union of slice names.
function applySlice(name: SliceName, value: unknown, event: TeselEvent): unknown {
  const slice = SLICES[name] as unknown as Slice<unknown, EventType>;
  return slice.apply(value, event);
}
