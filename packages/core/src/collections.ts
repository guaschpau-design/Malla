// Immutable, idempotent updates of the collections in the group state. Each returns the input
// collection itself when the event changes nothing, so callers can detect "no change" cheaply.

import type { TeseliaEvent } from '@teselia/protocol';

import { compareEvents, newerOf } from './ordering.ts';

/** Keeps, per key, the newest event by (time, origin, seq). */
export function keepNewest<K, T extends TeseliaEvent>(
  current: ReadonlyMap<K, T>,
  key: K,
  event: T,
): ReadonlyMap<K, T> {
  const known = current.get(key);
  if (known !== undefined && newerOf(known, event) === known) return current;
  return new Map(current).set(key, event);
}

/** Keeps, per key, the oldest event by (time, origin, seq). */
export function keepOldest<K, T extends TeseliaEvent>(
  current: ReadonlyMap<K, T>,
  key: K,
  event: T,
): ReadonlyMap<K, T> {
  const known = current.get(key);
  if (known !== undefined && compareEvents(known, event) <= 0) return current;
  return new Map(current).set(key, event);
}

/** Inserts keeping (time, origin, seq) order; an event already present changes nothing. */
export function insertOrdered<T extends TeseliaEvent>(list: readonly T[], event: T): readonly T[] {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = list[middle];
    if (item === undefined || compareEvents(item, event) >= 0) high = middle;
    else low = middle + 1;
  }
  const atPosition = list[low];
  if (atPosition?.origin === event.origin && atPosition.seq === event.seq) return list;
  return [...list.slice(0, low), event, ...list.slice(low)];
}
