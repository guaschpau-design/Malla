// Someone who needs the team at a place: a neighbour who has fallen, a family the water has
// trapped, one that has not left its house before the fire. They are seen to once enough of the
// team are with them, one of them carrying what it takes, for as long as it takes; until then, they
// wait. What each situation says about it, and what happens if nobody comes, is its own.

import { distanceMeters } from '@tesel/core';
import type { Equipment, LatLon } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';
import type { Teammate } from '../teammate.ts';

/** Someone this close is with them. */
const WITH_M = 20;

export interface Needs {
  /** How many of the team it takes. */
  readonly people: number;
  /** What one of them must carry; anything will do without. */
  readonly kit?: Equipment;
  /** Seconds it takes once they are there. */
  readonly seconds: number;
}

export class CallOut {
  readonly at: LatLon;
  readonly #needs: Needs;
  /** Since when enough of the team have been there, in milliseconds. */
  #since: number | null = null;
  #seen = false;

  constructor(at: LatLon, needs: Needs) {
    this.at = at;
    this.#needs = needs;
  }

  /** Whether they have been seen to. */
  get seen(): boolean {
    return this.#seen;
  }

  /** The teammates with them now. */
  with(stage: Stage): Teammate[] {
    return stage.crew.onTheGround.filter(
      (teammate) => distanceMeters(teammate.at(stage.now), this.at) <= WITH_M,
    );
  }

  /**
   * Moves on to now; returns who saw to them, the moment they are seen to, with whoever carries
   * what it takes first.
   */
  tick(stage: Stage): Teammate[] | null {
    if (this.#seen) return null;
    const there = this.with(stage);
    const { people, kit, seconds } = this.#needs;
    const equipped = kit === undefined || there.some((teammate) => teammate.has(kit));
    if (there.length < people || !equipped) {
      this.#since = null;
      return null;
    }
    this.#since ??= stage.now;
    if (stage.now - this.#since < seconds * 1000) return null;
    this.#seen = true;
    return kit === undefined
      ? there
      : [...there].sort((a, b) => Number(b.has(kit)) - Number(a.has(kit)));
  }
}
