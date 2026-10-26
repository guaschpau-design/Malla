// The operation areas of a group: shapes drawn with the operation area style (protocol §4.2),
// whose map each member is offered to download for use without a connection.

import { EARTH_RADIUS_M, type GroupState } from '@tesel/core';
import type { LatLon, ShapeGeometry } from '@tesel/protocol';

import { boundsAround, type Bounds } from '../map/tile-math.ts';
import { OPERATION_AREA_STYLE } from './catalog.ts';

export interface OperationArea {
  /** The object's reference key. */
  readonly key: string;
  readonly label: string;
  readonly bounds: Bounds;
}

export function operationAreas(state: GroupState): OperationArea[] {
  const areas: OperationArea[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'shape' || record.style !== OPERATION_AREA_STYLE) continue;
    areas.push({ key, label: record.label, bounds: boundsAround(extremes(record.geometry)) });
  }
  return areas;
}

/** Points whose bounds are the shape's: its vertices, or two corners around a circle. */
function extremes(geometry: ShapeGeometry): readonly LatLon[] {
  if (geometry.kind !== 'circle') return geometry.points;
  const { center, radius } = geometry;
  const dLat = (radius / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLon = dLat / Math.cos((center.lat * Math.PI) / 180);
  return [
    { lat: center.lat - dLat, lon: center.lon - dLon },
    { lat: center.lat + dLat, lon: center.lon + dLon },
  ];
}
