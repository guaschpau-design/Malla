// Free space on the disk that holds the database. Pushes are refused while it is short, so a
// flood of envelopes fills the disk up to a margin and no further, and the database, the system
// and its logs keep room to work.

import { statfsSync } from 'node:fs';

/** Free space is measured again after this time; a push in between uses the last measure. */
const MEASURE_EVERY_MS = 10_000;

export class DiskSpace {
  readonly #directory: string;
  readonly #minFreeBytes: number;
  #measuredAt = -Infinity;
  #hasRoom = true;

  /** Watches the file system of `directory`, which must exist. */
  constructor(directory: string, minFreeBytes: number) {
    this.#directory = directory;
    this.#minFreeBytes = minFreeBytes;
  }

  /** Whether more than the minimum is free. */
  hasRoom(): boolean {
    const now = Date.now();
    if (now - this.#measuredAt >= MEASURE_EVERY_MS) {
      this.#measuredAt = now;
      const stats = statfsSync(this.#directory);
      const hadRoom = this.#hasRoom;
      this.#hasRoom = stats.bavail * stats.bsize > this.#minFreeBytes;
      if (hadRoom && !this.#hasRoom) console.warn('The disk is nearly full: pushes are refused');
      if (!hadRoom && this.#hasRoom) console.warn('The disk has room again: pushes are accepted');
    }
    return this.#hasRoom;
  }
}
