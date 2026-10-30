// The director of an exercise: plays its injects, each once, at its moment and once its condition
// holds, as whoever runs a drill gives it its turns (a call, a change of wind, an order).

import type { Inject, Stage } from './exercise.ts';

export class Director {
  readonly #waiting: Set<Inject>;

  constructor(injects: readonly Inject[]) {
    this.#waiting = new Set(injects);
  }

  /** Plays the injects due now, in their order. */
  tick(stage: Stage): void {
    for (const inject of this.#waiting) {
      if (stage.elapsed < inject.at || !(inject.when?.(stage) ?? true)) continue;
      this.#waiting.delete(inject);
      inject.run(stage);
    }
  }
}
