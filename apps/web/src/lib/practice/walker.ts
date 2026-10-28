// Where a simulated member is, from moment to moment: standing still, or going along a way at
// their pace and stopping at its end. The practice run sets them off towards their tasks and the
// teammates they help (practice-run.ts); the way comes from the streets (errands.ts).

import { pathMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { pointAlong, WALKING_SPEED } from '@tesel/scenario';

export class Walker {
  readonly #speed: number;
  #way: readonly LatLon[];
  /** When the walker set off along the way, in milliseconds. */
  #since: number;

  constructor(at: LatLon, speed = WALKING_SPEED) {
    this.#speed = speed;
    this.#way = [at];
    this.#since = 0;
  }

  /** Where the walker is at `now`, in milliseconds. */
  at(now: number): LatLon {
    const first = this.#way[0];
    if (first === undefined) throw new Error('a walker with nowhere to be');
    return pointAlong(this.#way, (Math.max(0, now - this.#since) / 1000) * this.#speed);
  }

  /**
   * Sets off at `now` along `way`, from wherever the walker is then to the way's start first.
   * Returns when the walker will reach its end, in milliseconds.
   */
  go(way: readonly LatLon[], now: number): number {
    this.#way = [this.at(now), ...way];
    this.#since = now;
    return now + (pathMeters(this.#way) / this.#speed) * 1000;
  }

  /** Stops where the walker is at `now`. */
  stop(now: number): void {
    this.#way = [this.at(now)];
    this.#since = now;
  }
}
