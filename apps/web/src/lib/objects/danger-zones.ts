// The group's danger areas (protocol §4.2, style 0x0001) and which of them hold a point: each
// device warns its user on entering one, from its own position, with no network needed.

import { distanceMeters, type GroupState } from '@tesel/core';
import type { LatLon, ShapeGeometry } from '@tesel/protocol';

import { insideRing, toPosition } from '../map/geometry.ts';
import { DANGER_STYLE } from './catalog.ts';

export interface DangerZone {
  /** The object's reference key. */
  readonly key: string;
  readonly label: string;
  readonly geometry: Exclude<ShapeGeometry, { kind: 'polyline' }>;
}

/** The danger areas drawn in the group; lines are not areas and are left out. */
export function dangerZones(state: GroupState): DangerZone[] {
  const zones: DangerZone[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'shape' || record.style !== DANGER_STYLE) continue;
    const { geometry } = record;
    if (geometry.kind !== 'polyline') zones.push({ key, label: record.label, geometry });
  }
  return zones;
}

/** The danger areas a point is in. */
export function zonesAt(zones: readonly DangerZone[], at: LatLon): DangerZone[] {
  return zones.filter(({ geometry }) =>
    geometry.kind === 'circle'
      ? distanceMeters(geometry.center, at) <= geometry.radius
      : insideRing(geometry.points.map(toPosition), at),
  );
}
