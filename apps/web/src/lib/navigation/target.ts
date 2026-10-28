// Where navigation leads: a point picked on the map, a map object or a member, who may be moving.
// The target is followed by reference, so it moves with the member and ends if the object is
// deleted or the member hides their position.

import type { GroupState } from '@tesel/core';
import type { LatLon, NodeId } from '@tesel/protocol';

export type NavigationTarget = { readonly name: string } & (
  | { readonly kind: 'point'; readonly at: LatLon }
  | { readonly kind: 'object'; readonly key: string }
  | { readonly kind: 'member'; readonly id: NodeId }
);

/** Where the target is now, or null if it is no longer on the map. */
export function targetPosition(
  target: NavigationTarget,
  state: Pick<GroupState, 'objects' | 'positions'>,
): LatLon | null {
  switch (target.kind) {
    case 'point':
      return target.at;
    case 'object':
      return objectPosition(state, target.key);
    case 'member': {
      const report = state.positions.get(target.id);
      return report?.type === 'position' ? { lat: report.lat, lon: report.lon } : null;
    }
  }
}

/** Where an object is, when it is at one point: a marker, or a circle's centre. */
export function objectPosition(state: Pick<GroupState, 'objects'>, key: string): LatLon | null {
  const record = state.objects.get(key);
  if (record?.type === 'marker') return { lat: record.lat, lon: record.lon };
  if (record?.type === 'shape' && record.geometry.kind === 'circle') return record.geometry.center;
  return null;
}
