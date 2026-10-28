// Distances, bearings and areas on the Earth, for position thinning, drawing, measuring and
// navigating. A sphere of the mean radius is accurate to about 0.5 %, plenty for all of them.

import type { LatLon } from '@tesel/protocol';

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6_371_000;

const RAD = Math.PI / 180;

/**
 * The point `north` and `east` metres from `from` (negative for south and west), on a plane
 * fitted at `from`: for drawing circles and placing points a few kilometres away, not for long
 * journeys.
 */
export function offsetMeters(from: LatLon, north: number, east: number): LatLon {
  return {
    lat: from.lat + north / EARTH_RADIUS_M / RAD,
    lon: from.lon + east / (EARTH_RADIUS_M * Math.cos(from.lat * RAD)) / RAD,
  };
}

/** Great-circle distance (haversine), in metres. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The direction to set off from `a` to reach `b`, in degrees clockwise from true north, 0–360. */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  const dLon = (b.lon - a.lon) * RAD;
  const y = Math.sin(dLon) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Length of a path through the points in order, in metres. */
export function pathMeters(points: readonly LatLon[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (from && to) total += distanceMeters(from, to);
  }
  return total;
}

/**
 * Area enclosed by a ring of points, in square metres, on a plane fitted at the ring's centre.
 * Good to well under 1 % for areas a team draws (up to tens of kilometres across).
 */
export function areaSquareMeters(ring: readonly LatLon[]): number {
  if (ring.length < 3) return 0;
  const centreLat = ring.reduce((sum, point) => sum + point.lat, 0) / ring.length;
  const origin = ring[0] ?? { lat: 0, lon: 0 };
  // Metres east and north of the first point.
  const plane = ring.map((point) => ({
    x: (point.lon - origin.lon) * EARTH_RADIUS_M * RAD * Math.cos(centreLat * RAD),
    y: (point.lat - origin.lat) * EARTH_RADIUS_M * RAD,
  }));
  let twice = 0;
  for (const [index, point] of plane.entries()) {
    const next = plane[(index + 1) % plane.length] ?? point;
    twice += point.x * next.y - next.x * point.y;
  }
  return Math.abs(twice) / 2;
}
