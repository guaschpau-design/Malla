// What a simulated member does about a task: who among the simulated members does it, and the way
// they walk, along the streets, from where they are: to its place and, for a line, an area or a
// strip of a sweep, along it, as a person going round an area or sweeping a strip would.

import type { GroupState } from '@tesel/core';
import { eventRefKey, type LatLon, type NodeId, type TaskEvent } from '@tesel/protocol';
import type { WalkNetwork } from '@tesel/scenario';

import { objectAnchor } from '../objects/object-anchor.ts';
import { stripOf, stripPath } from '../objects/sweeps.ts';

/**
 * The simulated members who do a task: the one it is for, or those of the team it is for. None
 * for a task for anyone, or for someone who is not simulated: that is the user's.
 */
export function doersOf(
  task: TaskEvent,
  teams: GroupState['teams'],
  simulated: ReadonlySet<NodeId>,
): NodeId[] {
  if (task.assignee === null) return [];
  const members = teams.get(task.assignee)?.members ?? [task.assignee];
  return members.filter((member) => simulated.has(member));
}

/**
 * The points a task takes someone through: its point, a marker's, or the whole of a line, the
 * edge of an area or the lanes of a strip. Empty for a task with no place, or whose place is gone.
 */
export function errandPoints(task: TaskEvent, objects: GroupState['objects']): LatLon[] {
  const { place } = task;
  if (place === null) return [];
  if (place.kind === 'point') return [place.at];
  const record = objects.get(eventRefKey(place.object));
  if (record === undefined || record.type === 'object-delete') return [];
  if (record.type === 'sweep') {
    const strip = stripOf(record, objects);
    return strip ? stripPath(strip) : [];
  }
  if (record.type === 'shape' && record.geometry.kind === 'polyline') {
    return [...record.geometry.points];
  }
  if (record.type === 'shape' && record.geometry.kind === 'polygon') {
    const { points } = record.geometry;
    return [...points, ...points.slice(0, 1)];
  }
  const anchor = objectAnchor(record, objects);
  return anchor ? [anchor] : [];
}

/** The way through `points` from `from`: along the streets, or straight where there are none. */
export function wayThrough(
  from: LatLon,
  points: readonly LatLon[],
  network: WalkNetwork | null,
): LatLon[] {
  return network ? network.through([from, ...points]) : [from, ...points];
}
