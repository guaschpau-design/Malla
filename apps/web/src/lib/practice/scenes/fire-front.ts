// The front of a wildfire: it spreads from where it started, fastest with the wind, slowly at its
// flanks and hardly at all against it, unevenly, as fire does over scrub. Its spread is a list of
// phases (the wind, then the wind turned, then the aircraft working on it), so where it will be is
// known from the start: the homes it will threaten are chosen by that. Its edge is told by how far
// it reaches along each of a few dozen directions from where it started.

import { bearingDegrees, distanceMeters, offsetMeters, simplifyLine } from '@tesel/core';
import { SHAPE_MAX_POINTS, type LatLon } from '@tesel/protocol';

import type { Chance } from '../chance.ts';

/** A stretch of the fire's spread, from a moment on: where the wind drives it, and how fast. */
export interface Phase {
  /** Seconds into the exercise. */
  readonly from: number;
  /** The direction it spreads fastest in, in degrees from north. */
  readonly towards: number;
  /** How fast its head moves, in metres per second. */
  readonly speed: number;
}

/** The directions its edge is told by. */
const RAYS = 36;
/** How far it reaches when the exercise starts, in metres. */
const START_M = 50;
/** How fast its back and flanks move, as a share of its head's. */
const BACKING = 0.12;
/** How uneven its spread is, either side of the even. */
const UNEVEN = 0.25;

export class FireFront {
  readonly #origin: LatLon;
  readonly #phases: readonly Phase[];
  /** For each direction, how much faster or slower than even the fire goes. */
  readonly #pace: readonly number[];

  constructor(origin: LatLon, phases: readonly Phase[], chance: Chance) {
    this.#origin = origin;
    this.#phases = phases;
    const rough = Array.from({ length: RAYS }, () => chance.between(-UNEVEN, UNEVEN));
    // Each direction blended with its neighbours, so that the edge bulges rather than zigzags.
    this.#pace = rough.map(
      (value, ray) =>
        1 + (value + (rough[(ray + 1) % RAYS] ?? 0) + (rough[(ray + RAYS - 1) % RAYS] ?? 0)) / 3,
    );
  }

  /** The phase of the spread at `elapsed` seconds. */
  phaseAt(elapsed: number): Phase | undefined {
    return this.#phases.findLast((phase) => phase.from <= elapsed);
  }

  /** How far it reached at the moment last asked about, which is asked about again and again. */
  #last: { readonly elapsed: number; readonly reach: readonly number[] } | null = null;

  /** How far the fire reaches along each direction at `elapsed` seconds into the exercise. */
  reach(elapsed: number): readonly number[] {
    if (this.#last?.elapsed !== elapsed) this.#last = { elapsed, reach: this.#spread(elapsed) };
    return this.#last.reach;
  }

  #spread(elapsed: number): number[] {
    return this.#pace.map((pace, ray) => {
      let metres = START_M * pace;
      this.#phases.forEach((phase, index) => {
        const until = Math.min(elapsed, this.#phases[index + 1]?.from ?? Infinity);
        if (until <= phase.from) return;
        const off = ((ray * 360) / RAYS - phase.towards) * (Math.PI / 180);
        const ahead = Math.max(0, Math.cos(off)) ** 2;
        metres += (until - phase.from) * phase.speed * (BACKING + (1 - BACKING) * ahead) * pace;
      });
      return metres;
    });
  }

  /**
   * How far a point is from the fire at `elapsed` seconds, in metres along the direction from its
   * start: below zero inside it.
   */
  distanceTo(at: LatLon, elapsed: number, ahead = 0): number {
    const reach = this.reach(elapsed);
    const ray = ((bearingDegrees(this.#origin, at) + 360) % 360) / (360 / RAYS);
    const [below, above] = [Math.floor(ray) % RAYS, Math.ceil(ray) % RAYS];
    const along = ray - Math.floor(ray);
    const edge = (reach[below] ?? 0) * (1 - along) + (reach[above] ?? 0) * along;
    return distanceMeters(this.#origin, at) - edge - ahead;
  }

  /** The first moment, in seconds, the fire comes within `metres` of a point; null if never. */
  reaches(at: LatLon, metres: number, until: number): number | null {
    for (let second = 0; second <= until; second += 10) {
      if (this.distanceTo(at, second) <= metres) return second;
    }
    return null;
  }

  /**
   * Its edge at `elapsed` seconds, `beyond` metres out, as an area of at most the points a shape
   * holds.
   */
  edge(elapsed: number, beyond = 0): LatLon[] {
    const ring = this.reach(elapsed).map((metres, ray) => {
      const angle = ((ray * 360) / RAYS) * (Math.PI / 180);
      const out = metres + beyond;
      return offsetMeters(this.#origin, out * Math.cos(angle), out * Math.sin(angle));
    });
    const [first] = ring;
    if (first === undefined) return [];
    return simplifyLine([...ring, first], SHAPE_MAX_POINTS).points.slice(0, -1);
  }
}
