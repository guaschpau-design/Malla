// Sending something the user asked for, the same way everywhere (one way of doing it): a form
// keeps a `Submission`, which is busy while it goes and says whether it failed, so the form can
// say so and keep what was typed; a single button uses `attempt`, which tells the user with a
// notice if its action failed. When it failed because the device's storage is full, the user is
// told that instead, once for every such failure anywhere in the app (`useStorageFullNotice`).

import { untrack } from 'svelte';

import { storageRefusals } from '../storage/storage-space.svelte.ts';
import { notices, type StandingNotice } from './notices.svelte.ts';

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
      storageRefusals.note(error);
      this.failure = error;
      return false;
    } finally {
      this.busy = false;
    }
  }
}

/**
 * Runs an action of a button; if it fails, the user is told with `failure`, or that the storage is
 * full if that is why.
 */
export function attempt(action: () => Promise<unknown>, failure: string): void {
  action().catch((error: unknown) => {
    console.warn('Action failed', error);
    if (!storageRefusals.note(error)) notices.show(failure);
  });
}

/**
 * Tells the user with `notice` whenever the browser refuses to store something for lack of room,
 * whatever was storing it (storage/storage-space.svelte.ts): one notice at a time, which stays
 * until closed. Call it while the app initialises.
 */
export function useStorageFullNotice(notice: () => StandingNotice): void {
  let shown: number | null = null;
  $effect(() => {
    if (storageRefusals.count === 0) return;
    untrack(() => {
      if (shown !== null && notices.list.some(({ id }) => id === shown)) return;
      const { text, action } = notice();
      shown = notices.show(text, { stays: true, ...(action ? { action } : {}) });
    });
  });
}
