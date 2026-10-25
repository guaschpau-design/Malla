// The object being drawn, as GeoJSON for its preview on the map.

import type { Feature, FeatureCollection, Geometry } from 'geojson';

import { circleRing, distanceMeters, toPosition } from '../map/geometry.ts';
import type { Draft } from './draft.ts';

export function draftFeatures(draft: Draft): FeatureCollection {
  const features: Feature[] = draft.points.map((point) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: toPosition(point) },
    properties: {},
  }));
  const outline = draftOutline(draft);
  if (outline !== null) features.unshift({ type: 'Feature', geometry: outline, properties: {} });
  return { type: 'FeatureCollection', features };
}

function draftOutline(draft: Draft): Geometry | null {
  const [first, second] = draft.points;
  if (first === undefined || second === undefined) return null;
  switch (draft.kind) {
    case 'marker':
      return null;
    case 'line':
      return { type: 'LineString', coordinates: draft.points.map(toPosition) };
    case 'area':
      return {
        type: 'LineString',
        coordinates: [...draft.points, ...(draft.points.length > 2 ? [first] : [])].map(toPosition),
      };
    case 'circle':
      return { type: 'LineString', coordinates: circleRing(first, distanceMeters(first, second)) };
  }
}
