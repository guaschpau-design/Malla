// What a simulated member does about a task: who among the simulated members does it, and the way
// they walk, from where they are: along the streets to its place and, for a line or an area, along
// it, as a person going round an area would; for a strip of a sweep, along the streets to its
// first lane, then lane after lane straight across whatever is there, as a search line does.

import { membersFor, type GroupState } from '@tesel/core';
import { eventRefKey, type LatLon, type NodeId, type TaskEvent } from '@tesel/protocol';
import type { WalkNetwork } from '@tesel/scenario';

import { objectAnchor } from '../objects/object-anchor.ts';
import { stripOf, stripPath } from '../objects/sweeps.ts';

/**
 * The simulated members who do a task: the one it is for, or those in the team it is for. None
 * for a task for anyone, or for someone who is not simulated: that is the user's.
 */
export function doersOf(
  task: TaskEvent,
  teams: GroupState['teams'],
  simulated: ReadonlySet<NodeId>,
): NodeId[] {
  if (task.assignee === null) return [];
  return membersFor(teams, task.assignee).filter((member) => simulated.has(member));
}

/** The points a task takes someone through, in order. */
export interface Errand {
  readonly points: readonly LatLon[];
  /**
   * Whether, from the first point on, the way is straight across whatever is there and not along
   * the streets: the lanes of a strip of a sweep, which search the ground between them.
   */
  readonly across: boolean;
}

/**
 * The errand of a task: its point, a marker's, or the whole of a line, the edge of an area or the
 * lanes of a strip. No points for a task with no place, or whose place is gone.
 */
export function errandOf(task: TaskEvent, objects: GroupState['objects']): Errand {
  const along = (points: readonly LatLon[]): Errand => ({ points, across: false });
  const { place } = task;
  if (place === null) return along([]);
  if (place.kind === 'point') return along([place.at]);
  const record = objects.get(eventRefKey(place.object));
  if (record === undefined || record.type === 'object-delete') return along([]);
  if (record.type === 'sweep') {
    const strip = stripOf(record, objects);
    return { points: strip ? stripPath(strip) : [], across: true };
  }
  if (record.type === 'shape' && record.geometry.kind === 'polyline') {
    return along(record.geometry.points);
  }
  if (record.type === 'shape' && record.geometry.kind === 'polygon') {
    const { points } = record.geometry;
    return along([...points, ...points.slice(0, 1)]);
  }
  const anchor = objectAnchor(record, objects);
  return along(anchor ? [anchor] : []);
}

/** The way through an errand from `from`: along the streets, or straight where there are none. */
export function wayThrough(
  from: LatLon,
  { points, across }: Errand,
  network: WalkNetwork | null,
): LatLon[] {
  if (network === null) return [from, ...points];
  const [first, ...rest] = points;
  if (!across || first === undefined) return network.through([from, ...points]);
  return [...network.through([from, first]), first, ...rest];
}
