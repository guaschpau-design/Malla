// Following a route, a line of the map, from its start to its end: where to head now, how much
// is left, and whether this device has strayed from it. Progress only moves forwards, so a route
// that comes back the way it went, or zigzags up a slope, is followed leg by leg.

import { distanceMeters, nearestOnSegment, pathMeters, type SegmentPoint } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

import { legBetween, type Leg } from './leg.ts';

/** Farther than this from the route, or than the GPS can tell, this device has left it. */
const OFF_ROUTE_M = 50;
/** Legs this much farther than the nearest one are as near: the earliest of them is the one. */
const SAME_PLACE_M = 10;

export type RouteProgress =
  /** Not on the route yet: heading for its start. */
  | { readonly stage: 'to-start'; readonly to: LatLon; readonly leg: Leg }
  /** On the route: heading for its next point, the `next`-th of the route from 0. */
  | {
      readonly stage: 'on-route';
      readonly to: LatLon;
      readonly leg: Leg;
      readonly next: number;
      /** Metres from here to the end, along the route. */
      readonly remaining: number;
    }
  /** Strayed from the route: heading back to its nearest point still ahead. */
  | {
      readonly stage: 'off-route';
      readonly to: LatLon;
      readonly leg: Leg;
      readonly remaining: number;
    }
  /** At the end of the route. */
  | { readonly stage: 'arrived' };

/** Where this device is along one route, from each position it takes. */
export class RouteTracker {
  readonly #points: readonly LatLon[];
  /** The leg this device is on, from 0 for the one from the first point; -1 before the route. */
  #leg = -1;
  #arrived = false;

  /** `points` are those of the route, at least two. */
  constructor(points: readonly LatLon[]) {
    this.#points = points;
  }

  /** The progress at a new position; `accuracy` is the GPS's, in metres. */
  update(at: LatLon, accuracy: number | null): RouteProgress {
    const points = this.#points;
    const end = points.length - 1;
    const start = this.#point(0);
    if (this.#arrived) return { stage: 'arrived' };
    const limit = Math.max(OFF_ROUTE_M, accuracy ?? 0);
    if (this.#leg < 0) {
      if (nearestOnSegment(at, start, this.#point(1)).meters > limit) {
        return { stage: 'to-start', to: start, leg: legBetween(at, start, accuracy) };
      }
      this.#leg = 0;
    }
    let near = this.#nearestAhead(at);
    // A point reached moves on to the leg after it, even when the corner is cut.
    while (this.#leg < end - 1 && legBetween(at, this.#point(this.#leg + 1), accuracy).arrived) {
      this.#leg++;
      near = this.#nearestAhead(at);
    }
    if (this.#leg === end - 1 && legBetween(at, this.#point(end), accuracy).arrived) {
      this.#arrived = true;
      return { stage: 'arrived' };
    }
    const next = this.#leg + 1;
    const remaining = distanceMeters(near.at, this.#point(next)) + pathMeters(points.slice(next));
    if (near.meters > limit) {
      return { stage: 'off-route', to: near.at, leg: legBetween(at, near.at, accuracy), remaining };
    }
    const to = this.#point(next);
    return { stage: 'on-route', to, leg: legBetween(at, to, accuracy), next, remaining };
  }

  /**
   * Moves on to the leg from here on that passes nearest to `at`, the earliest of those about as
   * near, and tells where it does.
   */
  #nearestAhead(at: LatLon): SegmentPoint {
    const legs = this.#points
      .slice(this.#leg, -1)
      .map((from, index) => nearestOnSegment(at, from, this.#point(this.#leg + index + 1)));
    const nearest = Math.min(...legs.map((leg) => leg.meters));
    const index = legs.findIndex((leg) => leg.meters <= nearest + SAME_PLACE_M);
    this.#leg += index;
    return legs[index] ?? nearestOnSegment(at, this.#point(this.#leg), this.#point(this.#leg + 1));
  }

  #point(index: number): LatLon {
    const point = this.#points[index];
    if (point === undefined) throw new Error(`The route has no point ${String(index)}`);
    return point;
  }
}
