// The browser's storage as a whole: asking it to keep the app's data, knowing how much room is
// left, and noticing when it is full (ADR-0056). The group's log, its outbox and the maps all live
// there, and the log matters most: maps make room for it, never the other way round.

/**
 * Room kept free for the group's log whenever maps are stored. A day of a large group takes a few
 * megabytes once old positions are forgotten (ADR-0055); this leaves room for weeks of it.
 */
const LOG_HEADROOM_BYTES = 50 * 1024 * 1024;

/**
 * Asks the browser to keep this app's data under storage pressure instead of evicting it, as it
 * may otherwise do with a site's data: the identity, the groups and their logs would go with it.
 * The browser decides; a refusal changes nothing else.
 */
export async function keepStorage(): Promise<void> {
  try {
    await navigator.storage.persist();
  } catch (error) {
    console.warn('Could not ask to keep storage', error);
  }
}

/**
 * Bytes maps can still take, as the browser estimates the room left, once room is kept for the
 * group's log; null if the browser does not say.
 */
export async function roomForMaps(): Promise<number | null> {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined) return null;
    return Math.max(0, quota - usage - LOG_HEADROOM_BYTES);
  } catch {
    return null;
  }
}

/** Whether a failed write failed because the storage is full (the device's or the app's share). */
export function isStorageFull(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

/** Writes the browser refused for lack of room, which the app tells the user about. */
class StorageRefusals {
  /** How many so far; each one is told, unless the user is still being told of the last. */
  count = $state(0);

  /** Notes a failed write if it failed for lack of room, and says whether it did. */
  note(error: unknown): boolean {
    if (!isStorageFull(error)) return false;
    this.count++;
    return true;
  }
}

export const storageRefusals = new StorageRefusals();
