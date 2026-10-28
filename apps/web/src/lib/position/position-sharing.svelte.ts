// Shares this device's position with the active group in the mode the user chose
// (position-mode.ts). The choice is remembered, so sharing resumes after the app restarts.

import type { Preference } from '../settings/preference.svelte.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import type { DeviceFix, DeviceLocation } from './device-location.svelte.ts';
import type { PositionMode } from './position-mode.ts';
import { shouldReport, type Report } from './report-policy.ts';

export class PositionSharing {
  readonly #mode: Preference<PositionMode>;
  readonly #location: DeviceLocation;
  #feed: GroupFeed | null = null;
  /** Lets go of the GPS; set while sharing. */
  #release: (() => void) | null = null;
  #last: Report | null = null;

  constructor(mode: Preference<PositionMode>, location: DeviceLocation) {
    this.#mode = mode;
    this.#location = location;
  }

  get mode(): PositionMode {
    return this.#mode.value;
  }

  /** Starts serving a group's feed with the remembered mode. Publishes nothing by itself. */
  attach(feed: GroupFeed): void {
    this.detach();
    this.#feed = feed;
    if (this.mode === 'sharing') this.#startReporting();
  }

  /** Stops reporting, for instance when the active group changes. */
  detach(): void {
    this.#stopReporting();
    this.#feed = null;
  }

  async setMode(mode: PositionMode): Promise<void> {
    await this.#mode.set(mode);
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
      this.#report(fix).catch((error: unknown) => {
        console.warn('Sharing a position failed', error);
        storageRefusals.note(error);
      });
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
