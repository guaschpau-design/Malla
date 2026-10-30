// What a simulated member does about a task: who among the simulated members does it, and the way
// they walk, from where they are: along the streets to its place and, for a line, along it; for an
// area, through its streets, door to door, as someone warning the neighbours or looking for
// someone would (round its edge if no street runs through it); for a strip of a sweep, along the
// streets to its first lane, then lane after lane straight across whatever is there, as a search
// line does. They keep clear of what they cannot cross, or find there is no way.

import { distanceMeters, membersFor, type GroupState } from '@tesel/core';
import { eventRefKey, type LatLon, type NodeId, type TaskEvent } from '@tesel/protocol';
import type { Passable, WalkNetwork } from '@tesel/scenario';

import { insideRing, toPosition } from '../map/geometry.ts';
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

/**
 * The points a task takes someone through: along the streets in order (to a place, along a line);
 * straight across whatever is there once at the first (the lanes of a strip of a sweep, which
 * search the ground between them); or each of them, nearest first, as far as can be reached (the
 * streets of an area, door to door).
 */
export type Errand =
  | { readonly kind: 'along'; readonly points: readonly LatLon[] }
  | { readonly kind: 'across'; readonly points: readonly LatLon[] }
  | { readonly kind: 'visit'; readonly points: readonly LatLon[] };

/** Streets of an area this close together are one stop of a walk through it. */
const STOP_APART_M = 50;
/** The most stops a walk through an area makes: the longest a task takes. */
const MOST_STOPS = 25;

/**
 * The errand of a task: its point, a marker's, or the whole of a line, the streets of an area (its
 * edge, without the streets of `network`) or the lanes of a strip. No points for a task with no
 * place, or whose place is gone.
 */
export function errandOf(
  task: TaskEvent,
  objects: GroupState['objects'],
  network: WalkNetwork | null,
): Errand {
  const along = (points: readonly LatLon[]): Errand => ({ kind: 'along', points });
  const { place } = task;
  if (place === null) return along([]);
  if (place.kind === 'point') return along([place.at]);
  const record = objects.get(eventRefKey(place.object));
  if (record === undefined || record.type === 'object-delete') return along([]);
  if (record.type === 'sweep') {
    const strip = stripOf(record, objects);
    return { kind: 'across', points: strip ? stripPath(strip) : [] };
  }
  if (record.type === 'shape' && record.geometry.kind === 'polyline') {
    return along(record.geometry.points);
  }
  if (record.type === 'shape' && record.geometry.kind === 'polygon') {
    const { points } = record.geometry;
    const stops = network ? stopsIn(points, network) : [];
    return stops.length > 0
      ? { kind: 'visit', points: stops }
      : along([...points, ...points.slice(0, 1)]);
  }
  const anchor = objectAnchor(record, objects);
  return along(anchor ? [anchor] : []);
}

/** The junctions of the streets inside an area, at most a few dozen and some way apart. */
function stopsIn(area: readonly LatLon[], network: WalkNetwork): LatLon[] {
  const ring = area.map(toPosition);
  const stops: LatLon[] = [];
  for (const point of network.points) {
    if (stops.length === MOST_STOPS) break;
    if (!insideRing(ring, point)) continue;
    if (stops.every((other) => distanceMeters(other, point) >= STOP_APART_M)) stops.push(point);
  }
  return stops;
}

/**
 * The way through an errand from `from`: along the streets, or straight where there are none.
 * Null if `passable` leaves no way along the streets; for a visit, to any of its stops, the ones
 * that cannot be reached being left out.
 */
export function wayThrough(
  from: LatLon,
  errand: Errand,
  network: WalkNetwork | null,
  passable?: Passable,
): LatLon[] | null {
  const { points } = errand;
  if (network === null) return [from, ...points];
  switch (errand.kind) {
    case 'along':
      return network.through([from, ...points], passable);
    case 'across': {
      const [first, ...rest] = points;
      if (first === undefined) return network.through([from], passable);
      const there = network.through([from, first], passable);
      return there && [...there, first, ...rest];
    }
    case 'visit':
      return visit(from, points, network, passable);
  }
}

/** The way to each stop in turn, the nearest next each time, leaving out those out of reach. */
function visit(
  from: LatLon,
  stops: readonly LatLon[],
  network: WalkNetwork,
  passable: Passable | undefined,
): LatLon[] | null {
  const left = [...stops];
  const way = [network.snap(from)];
  for (let here = from; left.length > 0;) {
    const at = here;
    left.sort((a, b) => distanceMeters(at, a) - distanceMeters(at, b));
    const next = left.shift();
    if (next === undefined) break;
    const leg = network.way(at, next, passable);
    if (leg === null) continue;
    way.push(...leg.slice(1));
    here = next;
  }
  return way.length > 1 ? way : null;
}
