// The way from this device to a point: how far and in which direction.

import { bearingDegrees, distanceMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

/** Closer than this, or than the GPS can tell, the target is reached. */
export const ARRIVED_M = 15;

export interface Leg {
  readonly metres: number;
  /** Degrees clockwise from true north. */
  readonly bearing: number;
  readonly arrived: boolean;
}

export function legBetween(from: LatLon, to: LatLon, accuracy: number | null = null): Leg {
  const metres = distanceMeters(from, to);
  return {
    metres,
    bearing: bearingDegrees(from, to),
    arrived: metres <= Math.max(ARRIVED_M, accuracy ?? 0),
  };
}
