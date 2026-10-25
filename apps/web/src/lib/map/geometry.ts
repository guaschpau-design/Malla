// Geometry helpers for drawing on the map. Distances come from @teselia/core.

import { EARTH_RADIUS_M } from '@teselia/core';
import type { LatLon } from '@teselia/protocol';

/** A circle as a closed ring of [lon, lat] positions, for drawing. */
export function circleRing(center: LatLon, radius: number, steps = 48): [number, number][] {
  const rad = Math.PI / 180;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radius * Math.cos(angle)) / EARTH_RADIUS_M / rad;
    const dLon = (radius * Math.sin(angle)) / (EARTH_RADIUS_M * Math.cos(center.lat * rad)) / rad;
    ring.push([center.lon + dLon, center.lat + dLat]);
  }
  return ring;
}

export function toPosition(point: LatLon): [number, number] {
  return [point.lon, point.lat];
}
