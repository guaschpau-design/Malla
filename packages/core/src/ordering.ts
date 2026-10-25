// Last-writer-wins ordering (docs/protocol.md §3.10, ADR-0003).

import type { EventHeader } from '@teselia/protocol';

/**
 * Orders events by (time, origin, seq). Returns a negative number if `a` is older than `b`,
 * positive if newer, 0 only for the same event. Node IDs are fixed-length lowercase hex, so
 * comparing them as strings is the same as comparing their bytes as unsigned integers.
 */
export function compareEvents(a: EventHeader, b: EventHeader): number {
  if (a.time !== b.time) return a.time - b.time;
  if (a.origin !== b.origin) return a.origin < b.origin ? -1 : 1;
  return a.seq - b.seq;
}

/** The newer of two events according to `compareEvents`. */
export function newerOf<T extends EventHeader>(a: T, b: T): T {
  return compareEvents(a, b) >= 0 ? a : b;
}
