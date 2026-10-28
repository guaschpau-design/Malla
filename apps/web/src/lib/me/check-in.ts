// The safety check-in on this device (protocol §3.17): after a while without the member moving or
// touching it, the device asks whether they are well; with no answer in time, it calls for help.

/** After how many minutes without a tap or a move whoever coordinates has members asked. */
export const CHECK_IN_MINUTES = 30;

/** How long the member has to answer, in milliseconds. */
export const ANSWER_MS = 2 * 60_000;

/** Moving this far, in metres, counts as being up and about. */
export const MOVED_M = 25;

/** Nothing to say, asking, or help called for. */
export type CheckInStep = 'quiet' | 'asking' | 'called';

export class CheckIn {
  /** When the member last moved or touched the device, in milliseconds. */
  #since: number;
  #asked = 0;
  #step: CheckInStep = 'quiet';

  constructor(now: number) {
    this.#since = now;
  }

  get step(): CheckInStep {
    return this.#step;
  }

  /** While asking, when the answer is due. */
  get deadline(): number | null {
    return this.#step === 'asking' ? this.#asked + ANSWER_MS : null;
  }

  /** The member moved or touched the device: all is well, and the wait starts again. */
  activity(now: number): void {
    this.#since = now;
    this.#step = 'quiet';
  }

  /** What is due at `now`, after `limitMs` of quiet: to ask, to call for help, or nothing. */
  tick(now: number, limitMs: number): 'ask' | 'call' | null {
    if (this.#step === 'quiet' && now - this.#since >= limitMs) {
      this.#step = 'asking';
      this.#asked = now;
      return 'ask';
    }
    if (this.#step === 'asking' && now - this.#asked >= ANSWER_MS) {
      this.#step = 'called';
      return 'call';
    }
    return null;
  }
}
