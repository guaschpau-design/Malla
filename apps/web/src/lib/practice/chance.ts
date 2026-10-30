// The practice's dice: numbers that look random but follow from a seed, so that a run can be
// played again the same way in a test, and every practice plays out differently in the app.

/** A small, fast generator (mulberry32) whose numbers are spread evenly enough for a story. */
export class Chance {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** A number from 0 (included) to 1 (excluded). */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let mixed = this.#state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  }

  /** A number from `low` to `high`. */
  between(low: number, high: number): number {
    return low + (high - low) * this.next();
  }

  /** True with the probability given. */
  odds(probability: number): boolean {
    return this.next() < probability;
  }

  /** One of `items`, each as likely; an empty list has none. */
  pick<T>(items: readonly T[]): T | undefined {
    return items[Math.floor(this.next() * items.length)];
  }
}
