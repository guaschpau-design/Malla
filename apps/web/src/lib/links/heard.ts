// What this device has heard from each member, and through which channel: the time of the newest
// event of theirs that arrived by radio, through the group's server or through a command post.
// It tells who can be reached by radio directly. Duplicates count: an event already in the log
// that arrives again by radio still shows that the member's radio is heard.

import type { NodeId } from '@tesel/protocol';

import type { Channel } from './links.ts';

/** Per member and channel, the event time (seconds) of the newest event heard through it. */
export type Heard = ReadonlyMap<NodeId, Readonly<Partial<Record<Channel, number>>>>;

export const NOTHING_HEARD: Heard = new Map();

/** Records events heard together through one channel; the same map if nothing is newer. */
export function hear(
  heard: Heard,
  channel: Channel,
  events: Iterable<{ readonly origin: NodeId; readonly time: number }>,
): Heard {
  let next: Map<NodeId, Readonly<Partial<Record<Channel, number>>>> | null = null;
  for (const { origin, time } of events) {
    const known = (next ?? heard).get(origin);
    if ((known?.[channel] ?? -Infinity) >= time) continue;
    next ??= new Map(heard);
    next.set(origin, { ...known, [channel]: time });
  }
  return next ?? heard;
}
