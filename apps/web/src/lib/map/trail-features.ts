// Where members have been, as GeoJSON lines for the map: one per member with two positions or
// more, this device's own included.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import type { Feature, FeatureCollection, LineString } from 'geojson';

export interface TrailProperties {
  readonly self: boolean;
}

export function trailFeatures(
  state: GroupState,
  self: NodeId,
): FeatureCollection<LineString, TrailProperties> {
  const features: Feature<LineString, TrailProperties>[] = [];
  for (const [origin, trail] of state.trails) {
    if (trail.points.length < 2) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: trail.points.map((p) => [p.lon, p.lat]) },
      properties: { self: origin === self },
    });
  }
  return { type: 'FeatureCollection', features };
}
