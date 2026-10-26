// How this device shares its position with the active group (briefing §4): sharing, paused
// (the group keeps the last position, now out of date) or hidden (the group stops seeing it).
// The choice is remembered on the device, so sharing resumes after the app restarts.

import type { AppDb } from '../storage/app-db.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import type { DeviceFix, DeviceLocation } from './device-location.svelte.ts';
import { shouldReport, type Report } from './report-policy.ts';

export type PositionMode = 'sharing' | 'paused' | 'hidden';

const MODES: readonly PositionMode[] = ['sharing', 'paused', 'hidden'];

export async function loadPositionMode(db: AppDb): Promise<PositionMode> {
  const stored = await db.get('settings', 'positionMode');
  return MODES.find((mode) => mode === stored) ?? 'hidden';
}

export class PositionSharing {
  mode: PositionMode = $state('hidden');

  readonly #db: AppDb;
  readonly #location: DeviceLocation;
  #feed: GroupFeed | null = null;
  /** Lets go of the GPS; set while sharing. */
  #release: (() => void) | null = null;
  #last: Report | null = null;

  constructor(db: AppDb, location: DeviceLocation) {
    this.#db = db;
    this.#location = location;
  }

  /** Starts serving a group's feed with the remembered mode. Publishes nothing by itself. */
  attach(feed: GroupFeed, mode: PositionMode): void {
    this.detach();
    this.#feed = feed;
    this.mode = mode;
    if (mode === 'sharing') this.#startReporting();
  }

  /** Stops reporting, for instance when the active group changes. */
  detach(): void {
    this.#stopReporting();
    this.#feed = null;
  }

  async setMode(mode: PositionMode): Promise<void> {
    // Stored first, so what the screen shows is what the app will resume with.
    await this.#db.put('settings', mode, 'positionMode');
    this.mode = mode;
    if (mode === 'sharing') {
      this.#startReporting();
      return;
    }
    this.#stopReporting();
    if (mode === 'hidden') await this.#feed?.hidePosition();
  }

  #startReporting(): void {
    if (this.#release !== null) return;
    this.#last = null;
    this.#release = this.#location.use((fix) => {
      void this.#report(fix);
    });
  }

  #stopReporting(): void {
    this.#release?.();
    this.#release = null;
  }

  async #report(fix: DeviceFix): Promise<void> {
    const time = Math.floor(fix.time / 1000);
    if (this.#feed === null || !shouldReport(this.#last, fix.at, time)) return;
    this.#last = { at: fix.at, time };
    await this.#feed.sharePosition(fix);
  }
}
