// The course of a popular race (race.ts): a loop of the streets round the place, run as many times
// as makes about five kilometres, from a start and finish beside where the team gathers. Where it
// crosses other streets, traffic must be stopped while runners pass: the crossings to close. The
// runners are a field strung out from the leaders to the last: where they are at each moment, and
// whether any are passing a point of the loop, follows from their paces.

import { distanceMeters, offsetMeters, pathMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { pointAlong } from '@tesel/scenario';

import type { Ground } from '../ground.ts';

/** Seconds into the exercise the race starts: time for the team to take up their posts. */
export const START_S = 360;
/** The leaders' pace and the last runners', in metres per second: 3:12 and 7:56 a kilometre. */
const HEAD_MPS = 5.2;
const TAIL_MPS = 2.1;
/** About how long the race is. */
const RACE_M = 5000;
/** How far from the place the loop goes round, and through how many points. */
const LOOP_M = 330;
const LOOP_POINTS = 6;
/** How many crossings are closed, kept clear of the start and of one another. */
const CROSSINGS = 4;
const CROSSING_CLEAR_M = 150;

/** A crossing of the course with another street, where traffic is stopped while runners pass. */
export interface Crossing {
  readonly id: string;
  /** Its number, from the start. */
  readonly number: number;
  readonly at: LatLon;
  /** How far along the loop it is, in metres. */
  readonly along: number;
  /** The two streets that cross there, by name; null where the map does not name them. */
  readonly streets: readonly [string, string] | null;
}

export class RaceCourse {
  /** One lap, from the start round to it again. */
  readonly loop: readonly LatLon[];
  readonly lap: number;
  readonly laps: number;
  readonly crossings: readonly Crossing[];

  constructor(ground: Ground, centre: LatLon, meeting: LatLon) {
    const round = Array.from({ length: LOOP_POINTS }, (_, index) => {
      const angle = (2 * Math.PI * index) / LOOP_POINTS;
      return offsetMeters(centre, LOOP_M * Math.cos(angle), LOOP_M * Math.sin(angle));
    });
    const closed = [...round, ...round.slice(0, 1)];
    const loop = ground.network?.through(closed) ?? closed;
    this.loop = fromNearest(loop, meeting);
    this.lap = pathMeters(this.loop);
    this.laps = Math.max(1, Math.round(RACE_M / this.lap));
    this.crossings = crossingsOf(ground, this.loop, this.lap);
  }

  /** How long the race is, in metres. */
  get length(): number {
    return this.lap * this.laps;
  }

  /** Where the start and finish are. */
  get start(): LatLon {
    return this.pointAt(0);
  }

  /** The point `along` metres round the loop, however many laps that is. */
  pointAt(along: number): LatLon {
    return pointAlong(this.loop, ((along % this.lap) + this.lap) % this.lap);
  }

  /** How far the leaders have run at `elapsed` seconds into the exercise. */
  head(elapsed: number): number {
    return Math.min(this.length, Math.max(0, elapsed - START_S) * HEAD_MPS);
  }

  /** How far the last runners have run at `elapsed` seconds into the exercise. */
  tail(elapsed: number): number {
    return Math.min(this.length, Math.max(0, elapsed - START_S) * TAIL_MPS);
  }

  /** Whether runners are passing the point `along` metres round the loop now. */
  passing(along: number, elapsed: number): boolean {
    if (elapsed <= START_S) return false;
    const [tail, head] = [this.tail(elapsed), this.head(elapsed)];
    return Array.from({ length: this.laps }, (_, lap) => along + lap * this.lap).some(
      (run) => run >= tail && run <= head,
    );
  }

  /** When the leaders first pass the point `along` metres round the loop, in seconds. */
  headPasses(along: number): number {
    return START_S + along / HEAD_MPS;
  }

  /** When the leaders finish, in seconds into the exercise. */
  get winnerIn(): number {
    return START_S + this.length / HEAD_MPS;
  }
}

/** The loop turned to begin at its point nearest to `from`, and end there again. */
function fromNearest(loop: readonly LatLon[], from: LatLon): LatLon[] {
  const open = loop.slice(0, -1);
  const distances = open.map((point) => distanceMeters(point, from));
  const nearest = distances.indexOf(Math.min(...distances));
  const turned = [...open.slice(nearest), ...open.slice(0, nearest)];
  return [...turned, ...turned.slice(0, 1)];
}

/**
 * The crossings to close: where two named streets meet on the loop, as near as can be to each
 * fifth of the way round, and clear of the start; where the map names no streets, those points.
 */
function crossingsOf(ground: Ground, loop: readonly LatLon[], lap: number): Crossing[] {
  const along = cumulative(loop);
  const candidates = loop.flatMap((at, index) => {
    const metres = along[index] ?? 0;
    const streets = ground.crossingAt(at);
    return streets !== null && metres > CROSSING_CLEAR_M && metres < lap - CROSSING_CLEAR_M
      ? [{ at, along: metres, streets }]
      : [];
  });
  const chosen: { at: LatLon; along: number; streets: readonly [string, string] | null }[] = [];
  for (let index = 1; index <= CROSSINGS; index += 1) {
    const target = (lap * index) / (CROSSINGS + 1);
    const free = candidates.filter((candidate) =>
      chosen.every((taken) => Math.abs(taken.along - candidate.along) >= CROSSING_CLEAR_M),
    );
    const [best] = free.sort((a, b) => Math.abs(a.along - target) - Math.abs(b.along - target));
    chosen.push(best ?? { at: pointAlong(loop, target), along: target, streets: null });
  }
  return chosen
    .sort((a, b) => a.along - b.along)
    .map((crossing, index) => ({
      ...crossing,
      id: `crossing-${String(index + 1)}`,
      number: index + 1,
    }));
}

/** How far along a line each of its points is, in metres. */
function cumulative(line: readonly LatLon[]): number[] {
  let total = 0;
  return line.map((point, index) => {
    const previous = line[index - 1];
    if (previous !== undefined) total += distanceMeters(previous, point);
    return total;
  });
}
