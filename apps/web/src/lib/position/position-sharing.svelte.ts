// Sharing this device's live position with the active group, while the user wants it.

import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { shouldReport, type Report } from './report-policy.ts';

export type SharingProblem = 'denied' | 'unavailable';

export class PositionSharing {
  active = $state(false);
  problem: SharingProblem | null = $state(null);

  #feed: GroupFeed | null = null;
  #watch: number | null = null;
  #last: Report | null = null;

  /** Starts watching the device's position and reporting it to `feed`. */
  start(feed: GroupFeed): void {
    this.stop();
    this.#feed = feed;
    this.#last = null;
    this.problem = null;
    this.active = true;
    this.#watch = navigator.geolocation.watchPosition(
      (position) => {
        this.problem = null;
        void this.#report(position);
      },
      (error) => {
        this.problem = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  /** Stops reporting and tells the group, so this device disappears from their map. */
  stop(): void {
    if (this.#watch !== null) navigator.geolocation.clearWatch(this.#watch);
    this.#watch = null;
    if (this.active) void this.#feed?.hidePosition();
    this.#feed = null;
    this.active = false;
  }

  async #report(position: GeolocationPosition): Promise<void> {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const at = { lat: latitude, lon: longitude };
    const time = Math.floor(position.timestamp / 1000);
    if (this.#feed === null || !shouldReport(this.#last, at, time)) return;
    this.#last = { at, time };
    await this.#feed.sharePosition({
      ...at,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      heading: heading !== null && Number.isFinite(heading) ? heading : null,
      speed: speed !== null && Number.isFinite(speed) ? speed : null,
    });
  }
}
