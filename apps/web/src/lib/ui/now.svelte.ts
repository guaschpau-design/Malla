// The current time, in seconds, for what is shown relative to it ("stale", "3 min ago", warnings
// that expire). Every reader of the same pace shares one timer, which runs only while something
// on screen reads it (createSubscriber).

import { createSubscriber } from 'svelte/reactivity';

class Clock {
  readonly #subscribe: () => void;

  constructor(everyMs: number) {
    this.#subscribe = createSubscriber((update) => {
      const timer = setInterval(update, everyMs);
      return () => {
        clearInterval(timer);
      };
    });
  }

  get seconds(): number {
    this.#subscribe();
    return Date.now() / 1000;
  }
}

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache of clocks, never rendered
const clocks = new Map<number, Clock>();

/** A clock that moves on every `everyMs`. */
export function clockEvery(everyMs: number): { readonly seconds: number } {
  let clock = clocks.get(everyMs);
  if (clock === undefined) {
    clock = new Clock(everyMs);
    clocks.set(everyMs, clock);
  }
  return clock;
}
