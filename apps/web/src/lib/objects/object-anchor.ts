// Where a map object is, as one point: for what stands for it at a single place, such as a task
// on the object or a line of the diary.

import type { GroupState } from '@tesel/core';
import type { LatLon, MarkerEvent, ShapeEvent, SweepEvent } from '@tesel/protocol';

import { stripOf, stripPath } from './sweeps.ts';

/**
 * A marker's point, a circle's centre, a line's start, the middle of an area's corners, or where
 * a strip of a sweep starts; null for a strip whose area is gone.
 */
export function objectAnchor(
  object: MarkerEvent | ShapeEvent | SweepEvent,
  objects: GroupState['objects'],
): LatLon | null {
  if (object.type === 'marker') return { lat: object.lat, lon: object.lon };
  if (object.type === 'sweep') {
    const strip = stripOf(object, objects);
    return strip && (stripPath(strip)[0] ?? null);
  }
  const { geometry } = object;
  switch (geometry.kind) {
    case 'circle':
      return geometry.center;
    case 'polyline':
      return geometry.points[0] ?? null;
    case 'polygon': {
      const { points } = geometry;
      const sum = points.reduce((total, point) => ({
        lat: total.lat + point.lat,
        lon: total.lon + point.lon,
      }));
      return { lat: sum.lat / points.length, lon: sum.lon / points.length };
    }
  }
}
