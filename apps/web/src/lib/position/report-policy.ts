// When to publish this device's position over the internet. LoRa has its own, much stricter
// thinning in the airtime scheduler (ARCHITECTURE.md §4.2).

import type { LatLon } from '@teselia/protocol';

import { distanceMeters } from '../map/geometry.ts';

/** Never more often than this, however fast the device moves. */
export const MIN_INTERVAL_S = 5;
/** Report after moving this far... */
export const MIN_DISTANCE_M = 10;
/** ...or after this long, so others can tell the position is still live. */
export const HEARTBEAT_S = 60;

export interface Report {
  readonly at: LatLon;
  /** Seconds since the epoch. */
  readonly time: number;
}

export function shouldReport(last: Report | null, at: LatLon, time: number): boolean {
  if (last === null) return true;
  const elapsed = time - last.time;
  if (elapsed < MIN_INTERVAL_S) return false;
  return elapsed >= HEARTBEAT_S || distanceMeters(last.at, at) >= MIN_DISTANCE_M;
}
