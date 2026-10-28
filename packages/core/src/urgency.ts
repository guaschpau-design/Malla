// How urgent each kind of event is, for every transport that has to choose what goes first: the
// LoRa scheduler, and the outbox when it catches up with a server (ARCHITECTURE.md §4.2).

import type { EventType } from '@tesel/protocol';

/** Lower is more urgent. `POSITION_HIDDEN` is high so hiding is never delayed by positions. */
export const URGENCY: Readonly<Record<EventType, number>> = {
  sos: 0,
  'sos-cancel': 1,
  alert: 2,
  'roll-call': 2,
  'position-hidden': 3,
  ack: 4,
  chat: 5,
  task: 5,
  marker: 6,
  shape: 6,
  'object-delete': 6,
  sweep: 6,
  'member-info': 7,
  position: 8,
};

/** Urgency of an event type this version may not know: after every known one. */
export function urgencyOf(type: EventType | null): number {
  return type === null ? 9 : URGENCY[type];
}
