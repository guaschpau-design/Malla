// Sending something the user asked for, the same way everywhere (one way of doing it): a form
// keeps a `Submission`, which is busy while it goes and says whether it failed, so the form can
// say so and keep what was typed; a single button uses `attempt`, which tells the user with a
// notice if its action failed.

import { notices } from './notices.svelte.ts';

export class Submission {
  busy = $state(false);
  /** Why the last attempt failed, or null if it did not. */
  failure: unknown = $state.raw(null);

  get failed(): boolean {
    return this.failure !== null;
  }

  /** Runs `send` unless one is already going; true if it went through. */
  async run(send: () => Promise<unknown>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    this.failure = null;
    try {
      await send();
      return true;
    } catch (error) {
      console.warn('Sending failed', error);
      this.failure = error;
      return false;
    } finally {
      this.busy = false;
    }
  }
}

/** Runs an action of a button; if it fails, the user is told with `failure`. */
export function attempt(action: () => Promise<unknown>, failure: string): void {
  action().catch((error: unknown) => {
    console.warn('Action failed', error);
    notices.show(failure);
  });
}
