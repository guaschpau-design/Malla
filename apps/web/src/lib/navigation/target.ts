// Where navigation leads: a point picked on the map, a map object or a member, who may be moving.
// The target is followed by reference, so it moves with the member and ends if the object is
// deleted or the member hides their position. A line of the map is not a point to reach but a
// route to follow.

import type { GroupState, ObjectRecord } from '@tesel/core';
import type { LatLon, NodeId } from '@tesel/protocol';

export type NavigationTarget = { readonly name: string } & (
  | { readonly kind: 'point'; readonly at: LatLon }
  | { readonly kind: 'object'; readonly key: string }
  | { readonly kind: 'member'; readonly id: NodeId }
);

/** Where guidance leads: a point to reach, or a route to follow from its start to its end. */
export type Destination =
  | { readonly kind: 'point'; readonly at: LatLon }
  | { readonly kind: 'route'; readonly points: readonly LatLon[] };

/** Where the target is now, or null if it is no longer on the map. */
export function targetDestination(
  target: NavigationTarget,
  state: Pick<GroupState, 'objects' | 'positions'>,
): Destination | null {
  switch (target.kind) {
    case 'point':
      return { kind: 'point', at: target.at };
    case 'object':
      return objectDestination(state.objects.get(target.key));
    case 'member': {
      const report = state.positions.get(target.id);
      return report?.type === 'position'
        ? { kind: 'point', at: { lat: report.lat, lon: report.lon } }
        : null;
    }
  }
}

/**
 * Where guidance to an object leads: a marker, a circle's centre, or along a line. An area has no
 * one place to go to, and a deleted object none at all.
 */
export function objectDestination(record: ObjectRecord | undefined): Destination | null {
  if (record?.type === 'marker') return { kind: 'point', at: { lat: record.lat, lon: record.lon } };
  if (record?.type !== 'shape') return null;
  const { geometry } = record;
  switch (geometry.kind) {
    case 'circle':
      return { kind: 'point', at: geometry.center };
    case 'polyline':
      return { kind: 'route', points: geometry.points };
    case 'polygon':
      return null;
  }
}
