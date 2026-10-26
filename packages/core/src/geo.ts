// Distances on the Earth, for position thinning and drawing.

import type { LatLon } from '@tesel/protocol';

/** Mean Earth radius in metres. */
export const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance (haversine), in metres. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
