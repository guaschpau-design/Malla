// Where a map object is, as one point: for what stands for it at a single place, such as a task
// on the object or a line of the diary.

import type { LatLon, MarkerEvent, ShapeEvent } from '@tesel/protocol';

/** A marker's point, a circle's centre, a line's start, or the middle of an area's corners. */
export function objectAnchor(object: MarkerEvent | ShapeEvent): LatLon {
  if (object.type === 'marker') return { lat: object.lat, lon: object.lon };
  const { geometry } = object;
  switch (geometry.kind) {
    case 'circle':
      return geometry.center;
    case 'polyline':
      return geometry.points[0] ?? { lat: 0, lon: 0 };
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
