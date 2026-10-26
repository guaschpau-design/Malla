// The points tapped so far, as GeoJSON for their preview on the map: the points, and the path
// through them once there are two, closed for an area.

import type { LatLon } from '@tesel/protocol';
import type { Feature, FeatureCollection } from 'geojson';

import { toPosition } from '../map/geometry.ts';

export function draftFeatures(points: readonly LatLon[], closed: boolean): FeatureCollection {
  const features: Feature[] = points.map((point) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: toPosition(point) },
    properties: {},
  }));
  const [first] = points;
  if (first !== undefined && points.length >= 2) {
    const path = closed && points.length > 2 ? [...points, first] : points;
    features.unshift({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: path.map(toPosition) },
      properties: {},
    });
  }
  return { type: 'FeatureCollection', features };
}
