// The group on the move in the mountains (mountain-world.ts): one behind another along the route,
// a few metres apart, at the pace of the group: up to the top, or back down once it turns. Whoever
// has nothing else to do walks in it; whoever is sent on a task, or stays with someone, leaves it,
// and joins it again once free. It can stop, and wait, with someone hurt.

import type { Stage } from '../exercise.ts';
import type { Teammate } from '../teammate.ts';
import type { MountainRoute } from './mountain-route.ts';

/** The group's pace up and down, in metres per second. */
const UP_MPS = 0.75;
const DOWN_MPS = 1;
/** Metres between one and the next. */
const SPACING_M = 6;
/** Seconds between each one being sent on to their place in the column. */
const STEP_S = 5;
/** What the column is to those in it, so that none asks what to do. */
const IN_COLUMN = 'column';

export class Column {
  readonly #route: MountainRoute;
  /** The order they walk in, by alias: the guide first, the sweeper last. */
  readonly #order: readonly string[];
  /** How far up the route the head of the column is, in metres. */
  #along = 0;
  #down = false;
  #halted = false;
  /** Seconds into the exercise of the last move. */
  #last = 0;

  constructor(route: MountainRoute, order: readonly string[]) {
    this.#route = route;
    this.#order = order;
  }

  /** How far up the route the head of the column is, in metres. */
  get along(): number {
    return this.#along;
  }

  get down(): boolean {
    return this.#down;
  }

  /** Whether the column has got to the top. */
  get atTop(): boolean {
    return !this.#down && this.#along >= this.#route.length;
  }

  /** The group turns back down. */
  turn(): void {
    this.#down = true;
    this.#halted = false;
  }

  /** The group stops where it is, or moves on again. */
  halt(halted: boolean): void {
    this.#halted = halted;
  }

  /** Those walking in the column now, in their order. */
  walkers(stage: Stage): Teammate[] {
    return this.#order.flatMap((alias) => {
      const who = stage.crew.byAlias(alias);
      return who !== undefined && who.onFoot && !who.silent && who.job === null ? [who] : [];
    });
  }

  tick(stage: Stage): void {
    const passed = stage.elapsed - this.#last;
    if (passed < STEP_S) return;
    this.#last = stage.elapsed;
    if (!this.#halted) {
      const moved = passed * (this.#down ? -DOWN_MPS : UP_MPS);
      this.#along = Math.min(this.#route.length, Math.max(0, this.#along + moved));
    }
    this.walkers(stage).forEach((who, index) => {
      const behind = index * SPACING_M;
      const place = this.#route.pointAt(this.#down ? this.#along + behind : this.#along - behind);
      const from = who.at(stage.now);
      const way = stage.ground.network?.way(from, place) ?? [from, place];
      who.walker.go(way, stage.now);
      who.guard(IN_COLUMN);
    });
  }
}
