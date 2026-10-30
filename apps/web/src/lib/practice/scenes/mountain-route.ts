// The route of a mountain outing (mountain.ts): from the trailhead, where the map is, up the paths
// of the base map to the highest point they reach round it, and back the same way. Where the paths
// fork into one that leads nowhere, someone can lose the group in the fog. A place is fit for it
// only where the land rises enough and there are paths to follow.

import { distanceMeters, pathMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { pointAlong } from '@tesel/scenario';

import type { Ground } from '../ground.ts';

/** The least rise from the trailhead to the top for a place to be a mountain. */
const LEAST_RISE_M = 150;
/** The top is sought this far round the trailhead at most, within the land that is known. */
const TOP_WITHIN_M = 650;
/** A fork that leads nowhere, this far from the route at most, is where one can go astray. */
const ASTRAY_WITHIN_M = 300;

export class MountainRoute {
  /** From the trailhead to the top. */
  readonly way: readonly LatLon[];
  readonly length: number;
  /** Heights of the trailhead and the top, in metres above sea level. */
  readonly low: number;
  readonly high: number;

  private constructor(way: readonly LatLon[], low: number, high: number) {
    this.way = way;
    this.length = pathMeters(way);
    this.low = low;
    this.high = high;
  }

  /** The route up from `trailhead`, or null if the place has no mountain to climb or no paths. */
  static from(ground: Ground, trailhead: LatLon): MountainRoute | null {
    const { network, heights } = ground;
    if (network === null || heights === null) return null;
    const start = network.snap(trailhead);
    const low = heights.at(start);
    const tops = network.points
      .filter((point) => distanceMeters(start, point) <= TOP_WITHIN_M)
      .sort((a, b) => heights.at(b) - heights.at(a));
    for (const top of tops.slice(0, 5)) {
      const high = heights.at(top);
      if (high - low < LEAST_RISE_M) return null;
      const way = network.way(start, top);
      if (way !== null) return new MountainRoute(way, low, high);
    }
    return null;
  }

  get top(): LatLon {
    return this.pointAt(this.length);
  }

  /** The point `along` metres up the route from the trailhead. */
  pointAt(along: number): LatLon {
    return pointAlong(this.way, Math.min(this.length, Math.max(0, along)));
  }

  /** How far up the route a point is, in metres: that of the route's point nearest to it. */
  alongOf(at: LatLon): number {
    let best = { along: 0, metres: Infinity };
    let along = 0;
    this.way.forEach((point, index) => {
      const previous = this.way[index - 1];
      if (previous !== undefined) along += distanceMeters(previous, point);
      const metres = distanceMeters(point, at);
      if (metres < best.metres) best = { along, metres };
    });
    return best.along;
  }

  /** A path's end that leads nowhere, off the route but near `from`: where one goes astray. */
  astray(ground: Ground, from: LatLon): LatLon | null {
    const onRoute = (point: LatLon) => this.way.some((step) => distanceMeters(step, point) < 40);
    const ends = (ground.network?.deadEnds ?? []).filter(
      (end) => !onRoute(end) && distanceMeters(end, from) <= ASTRAY_WITHIN_M,
    );
    return ends.sort((a, b) => distanceMeters(a, from) - distanceMeters(b, from))[0] ?? null;
  }
}
