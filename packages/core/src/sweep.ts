// The lanes of a sweep (docs/protocol.md §3.13): a search area walked in parallel lanes, split
// into strips, one per team. Only the recipe travels; every device works the lanes out here, the
// same way. Lanes are worked out on a plane fitted at the area's first point, in metres: `u`
// across the lanes and `v` along them.

import type { LatLon } from '@tesel/protocol';

import { eastNorthMeters, offsetMeters } from './geo.ts';

const RAD = Math.PI / 180;

/** One lane: where it runs across the area, and its stretches inside it, as `v` from and to. */
export interface Lane {
  readonly u: number;
  readonly spans: readonly (readonly [number, number])[];
}

/** Lanes over an area, in its plane. */
export interface SweepLanes {
  /** The area's first point, where the plane is fitted. */
  readonly origin: LatLon;
  /** Direction of the lanes, degrees clockwise from true north. */
  readonly heading: number;
  /** In increasing `u`. */
  readonly lanes: readonly Lane[];
}

interface PlanePoint {
  readonly u: number;
  readonly v: number;
}

/** The lanes `spacing` metres apart that sweep a polygon in the direction `heading` (§3.13). */
export function sweepLanes(area: readonly LatLon[], spacing: number, heading: number): SweepLanes {
  const origin = area[0] ?? { lat: 0, lon: 0 };
  const corners = area.map((point) => toPlane(origin, heading, point));
  const across = corners.map((corner) => corner.u);
  const min = Math.min(...across);
  const max = Math.max(...across);
  const positions: number[] = [];
  for (let u = min + spacing / 2; u < max; u = min + spacing * (positions.length + 0.5)) {
    positions.push(u);
  }
  if (positions.length === 0) positions.push((min + max) / 2);
  return {
    origin,
    heading,
    lanes: positions.map((u) => ({ u, spans: spansAt(corners, u) })),
  };
}

/** The lanes of strip `strip` of `strips` (§3.13). */
export function stripLanes(sweep: SweepLanes, strip: number, strips: number): SweepLanes {
  const count = sweep.lanes.length;
  const from = Math.floor((strip * count) / strips);
  const to = Math.floor(((strip + 1) * count) / strips);
  return { ...sweep, lanes: sweep.lanes.slice(from, to) };
}

/** The way through the lanes: one after another, each the other way from the one before. */
export function sweepPath(sweep: SweepLanes): LatLon[] {
  return sweep.lanes.flatMap((lane, index) => {
    const ends = lane.spans.flatMap(([from, to]) => [
      { u: lane.u, v: from },
      { u: lane.u, v: to },
    ]);
    const ordered = index % 2 === 0 ? ends : ends.reverse();
    return ordered.map((point) => fromPlane(sweep, point));
  });
}

/** Each stretch of each lane, as a line of two points, to draw them. */
export function laneLines(sweep: SweepLanes): [LatLon, LatLon][] {
  return sweep.lanes.flatMap((lane) =>
    lane.spans.map(([from, to]): [LatLon, LatLon] => [
      fromPlane(sweep, { u: lane.u, v: from }),
      fromPlane(sweep, { u: lane.u, v: to }),
    ]),
  );
}

/** Metres to walk along the lanes, without the steps from one lane to the next. */
export function lanesLength(sweep: SweepLanes): number {
  return sweep.lanes.reduce(
    (total, lane) => total + lane.spans.reduce((sum, [from, to]) => sum + to - from, 0),
    0,
  );
}

/**
 * How much of the lanes, from 0 to 1, a trail has passed along within `reach` metres: the part
 * swept, from the positions of whoever walks them.
 */
export function sweptFraction(sweep: SweepLanes, trail: readonly LatLon[], reach: number): number {
  const total = lanesLength(sweep);
  if (total === 0) return 0;
  const points = trail.map((point) => toPlane(sweep.origin, sweep.heading, point));
  const steps = points.length === 1 ? [[points[0], points[0]] as const] : pairs(points);
  let swept = 0;
  for (const lane of sweep.lanes) {
    const passed = merged(steps.flatMap(([from, to]) => passedAlong(lane.u, from, to, reach)));
    for (const span of lane.spans) {
      for (const interval of passed) swept += overlap(span, interval);
    }
  }
  return Math.min(1, swept / total);
}

/** The heading whose lanes are fewest: along the area's longest way, with the fewest turns. */
export function bestHeading(area: readonly LatLon[]): number {
  const origin = area[0] ?? { lat: 0, lon: 0 };
  let best = 0;
  let narrowest = Infinity;
  for (let heading = 0; heading < 180; heading++) {
    const across = area.map((point) => toPlane(origin, heading, point).u);
    const width = Math.max(...across) - Math.min(...across);
    if (width < narrowest - 1e-6) {
      best = heading;
      narrowest = width;
    }
  }
  return best;
}

function toPlane(origin: LatLon, heading: number, point: LatLon): PlanePoint {
  const { east, north } = eastNorthMeters(origin, point);
  const sin = Math.sin(heading * RAD);
  const cos = Math.cos(heading * RAD);
  return { u: east * cos - north * sin, v: east * sin + north * cos };
}

function fromPlane(sweep: SweepLanes, { u, v }: PlanePoint): LatLon {
  const sin = Math.sin(sweep.heading * RAD);
  const cos = Math.cos(sweep.heading * RAD);
  return offsetMeters(sweep.origin, -u * sin + v * cos, u * cos + v * sin);
}

/** Where the lane at `u` is inside the polygon: its crossings with the edges, paired. */
function spansAt(corners: readonly PlanePoint[], u: number): [number, number][] {
  const crossings: number[] = [];
  for (const [index, from] of corners.entries()) {
    const to = corners[(index + 1) % corners.length] ?? from;
    if (Math.min(from.u, to.u) <= u && u < Math.max(from.u, to.u)) {
      crossings.push(from.v + ((u - from.u) * (to.v - from.v)) / (to.u - from.u));
    }
  }
  crossings.sort((a, b) => a - b);
  const spans: [number, number][] = [];
  for (let index = 0; index + 1 < crossings.length; index += 2) {
    spans.push([crossings[index] ?? 0, crossings[index + 1] ?? 0]);
  }
  return spans;
}

function pairs<T>(list: readonly T[]): (readonly [T, T])[] {
  return list.slice(1).map((to, index) => [list[index] ?? to, to] as const);
}

/** The stretch of the lane at `u` that a step from one point to another passes within `reach` of. */
function passedAlong(
  u: number,
  from: PlanePoint | undefined,
  to: PlanePoint | undefined,
  reach: number,
): [number, number][] {
  if (from === undefined || to === undefined) return [];
  const du = to.u - from.u;
  let start = 0;
  let end = 1;
  if (du === 0) {
    if (Math.abs(from.u - u) > reach) return [];
  } else {
    const a = (u - reach - from.u) / du;
    const b = (u + reach - from.u) / du;
    start = Math.max(0, Math.min(a, b));
    end = Math.min(1, Math.max(a, b));
    if (start > end) return [];
  }
  const vStart = from.v + start * (to.v - from.v);
  const vEnd = from.v + end * (to.v - from.v);
  // A step standing still still sweeps what is within reach of it.
  const pad = vStart === vEnd ? reach : 0;
  return [[Math.min(vStart, vEnd) - pad, Math.max(vStart, vEnd) + pad]];
}

function merged(intervals: [number, number][]): [number, number][] {
  const sorted = intervals.sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (last !== undefined && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else result.push([interval[0], interval[1]]);
  }
  return result;
}

function overlap(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}
