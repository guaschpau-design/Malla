// The water of a flood: it comes out of a channel (a stream of the map, or a ravine where there is
// none) and spreads over whatever lies lower than its level, as long as it can get there, following
// the lie of the land where it is known. Its level rises for the first quarter of an hour, holds,
// then starts to fall. The ground is a grid of points round the place: at each, how high the water
// must be to reach it (its height over the channel, and a little more the further it is, as land
// rises away from a river, with some unevenness).

import { eastNorthMeters, nearestOnSegment, offsetMeters, simplifyLine } from '@tesel/core';
import { SHAPE_MAX_POINTS, type LatLon } from '@tesel/protocol';

import type { Chance } from '../chance.ts';
import type { HeightGrid } from '../heights.ts';
import { outline } from './contour.ts';

/** Metres between the points of the grid, and how far it reaches from the middle. */
const STEP_M = 20;
const REACH_M = 700;
/** How much higher land is, per metre further from the channel. */
const RISE_PER_M = 0.006;
/** How uneven the land is beyond what the map knows, up and down, and how wide its bumps are. */
const UNEVEN_M = 0.25;
const BUMPS_M = 100;
/** Points this close to the channel are in it. */
const CHANNEL_M = 15;

/** How high the water is over the channel, in metres, at moments of the exercise in seconds. */
const LEVELS: readonly (readonly [number, number])[] = [
  [0, 0.25],
  [900, 1.5],
  [1200, 1.5],
  [1500, 1.2],
];

/** What the water covers at one moment. */
export interface Flooding {
  readonly level: number;
  /** For each point of the grid, whether the water is there. */
  readonly wet: Uint8Array;
  readonly points: number;
}

export class FloodWater {
  readonly #corner: LatLon;
  readonly #size: number;
  /** For each point of the grid, the level the water must reach to get there. */
  readonly #reach: Float64Array;
  /** The points of the grid the water comes out of. */
  readonly #sources: readonly number[];

  constructor(
    centre: LatLon,
    channel: readonly (readonly LatLon[])[],
    heights: HeightGrid | null,
    chance: Chance,
  ) {
    this.#size = Math.floor((2 * REACH_M) / STEP_M) + 1;
    this.#corner = offsetMeters(centre, -REACH_M, -REACH_M);
    const points = Array.from({ length: this.#size ** 2 }, (_, index) => this.#point(index));
    const away = points.map((point) => distanceTo(channel, point));
    const ground = heights ? points.map((point) => heights.at(point)) : points.map(() => 0);
    const bed = Math.min(...ground.filter((_, index) => (away[index] ?? Infinity) <= CHANNEL_M));
    const bump = bumps(this.#size, chance);
    this.#reach = Float64Array.from(
      points,
      (_, index) =>
        (ground[index] ?? 0) -
        (Number.isFinite(bed) ? bed : 0) +
        RISE_PER_M * (away[index] ?? 0) +
        (bump[index] ?? 0),
    );
    this.#sources = away.flatMap((metres, index) => (metres <= CHANNEL_M ? [index] : []));
  }

  /** How high the water is over the channel at `elapsed` seconds into the exercise. */
  static level(elapsed: number): number {
    for (let index = 1; index < LEVELS.length; index += 1) {
      const [from, low] = LEVELS[index - 1] ?? [0, 0];
      const [to, high] = LEVELS[index] ?? [0, 0];
      if (elapsed > to) continue;
      const along = Math.max(0, (elapsed - from) / (to - from));
      // Gently in and out of each change, as a river swells and settles.
      return low + (high - low) * along * along * (3 - 2 * along);
    }
    return LEVELS.at(-1)?.[1] ?? 0;
  }

  /**
   * What the water covers at a level: the points lower than it that it can reach from the channel,
   * point by neighbouring point.
   */
  flooding(level: number): Flooding {
    const wet = new Uint8Array(this.#size ** 2);
    const queue = [...this.#sources];
    for (const source of queue) wet[source] = 1;
    let points = queue.length;
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
      const [row, column] = [Math.floor(next / this.#size), next % this.#size];
      for (const [r, c] of [
        [row + 1, column],
        [row - 1, column],
        [row, column + 1],
        [row, column - 1],
      ] as const) {
        if (r < 0 || c < 0 || r >= this.#size || c >= this.#size) continue;
        const index = r * this.#size + c;
        if (wet[index] === 1 || (this.#reach[index] ?? Infinity) >= level) continue;
        wet[index] = 1;
        points += 1;
        queue.push(index);
      }
    }
    return { level, wet, points };
  }

  /** How deep the water is at a point; 0 where it is dry, or beyond the grid. */
  depthAt(at: LatLon, { level, wet }: Flooding): number {
    const index = this.#index(at);
    if (index === null || wet[index] !== 1) return 0;
    return Math.max(0, level - (this.#reach[index] ?? Infinity));
  }

  /** How high the water must rise to reach a point. */
  reachAt(at: LatLon): number {
    const index = this.#index(at);
    return index === null ? Infinity : (this.#reach[index] ?? Infinity);
  }

  /** The edge of the water, as an area of at most the points a shape holds. */
  edge({ level, wet }: Flooding): LatLon[] {
    const depths = Float64Array.from(this.#reach, (reach, index) =>
      wet[index] === 1 ? Math.max(level - reach, 0.01) : -1,
    );
    const ring = outline(depths, this.#size).map(({ row, column }) =>
      offsetMeters(this.#corner, row * STEP_M, column * STEP_M),
    );
    const [first] = ring;
    if (first === undefined) return [];
    const { points } = simplifyLine([...ring, first], SHAPE_MAX_POINTS);
    return points.slice(0, -1);
  }

  #point(index: number): LatLon {
    return offsetMeters(
      this.#corner,
      Math.floor(index / this.#size) * STEP_M,
      (index % this.#size) * STEP_M,
    );
  }

  /** The grid point nearest to a place; null beyond the grid. */
  #index(at: LatLon): number | null {
    const { north, east } = eastNorthMeters(this.#corner, at);
    const [row, column] = [Math.round(north / STEP_M), Math.round(east / STEP_M)];
    if (row < 0 || column < 0 || row >= this.#size || column >= this.#size) return null;
    return row * this.#size + column;
  }
}

/** Metres from a point to the nearest of some lines. */
function distanceTo(lines: readonly (readonly LatLon[])[], point: LatLon): number {
  let nearest = Infinity;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const [a, b] = [line[index - 1], line[index]];
      if (a && b) nearest = Math.min(nearest, nearestOnSegment(point, a, b).meters);
    }
  }
  return nearest;
}

/**
 * Smooth unevenness over the grid: random heights every few points, blended between, so that the
 * water's edge wanders as it does on real ground.
 */
function bumps(size: number, chance: Chance): Float64Array {
  const every = BUMPS_M / STEP_M;
  const coarse = Math.ceil(size / every) + 2;
  const knots = Array.from({ length: coarse ** 2 }, () => chance.between(-UNEVEN_M, UNEVEN_M));
  const knot = (r: number, c: number) => knots[r * coarse + c] ?? 0;
  return Float64Array.from({ length: size ** 2 }, (_, index) => {
    const [row, column] = [Math.floor(index / size) / every, (index % size) / every];
    const [r, c] = [Math.floor(row), Math.floor(column)];
    const [dr, dc] = [row - r, column - c];
    return (
      knot(r, c) * (1 - dr) * (1 - dc) +
      knot(r, c + 1) * (1 - dr) * dc +
      knot(r + 1, c) * dr * (1 - dc) +
      knot(r + 1, c + 1) * dr * dc
    );
  });
}
