// How this device shares its position with the active group (briefing §4): sharing, paused
// (the group keeps the last position, now out of date) or hidden (the group stops seeing it).
// The choice is remembered on the device, so sharing resumes after the app restarts.

import type { AppDb } from '../storage/app-db.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { shouldReport, type Report } from './report-policy.ts';

export type PositionMode = 'sharing' | 'paused' | 'hidden';
export type SharingProblem = 'denied' | 'unavailable';

const MODES: readonly PositionMode[] = ['sharing', 'paused', 'hidden'];

export async function loadPositionMode(db: AppDb): Promise<PositionMode> {
  const stored = await db.get('settings', 'positionMode');
  return MODES.find((mode) => mode === stored) ?? 'hidden';
}

export class PositionSharing {
  mode: PositionMode = $state('hidden');
  problem: SharingProblem | null = $state(null);

  readonly #db: AppDb;
  #feed: GroupFeed | null = null;
  #watch: number | null = null;
  #last: Report | null = null;

  constructor(db: AppDb) {
    this.#db = db;
  }

  /** Starts serving a group's feed with the remembered mode. Publishes nothing by itself. */
  attach(feed: GroupFeed, mode: PositionMode): void {
    this.detach();
    this.#feed = feed;
    this.mode = mode;
    if (mode === 'sharing') this.#startWatching();
  }

  /** Stops watching the position, for instance when the active group changes. */
  detach(): void {
    this.#stopWatching();
    this.#feed = null;
  }

  async setMode(mode: PositionMode): Promise<void> {
    // Stored first, so what the screen shows is what the app will resume with.
    await this.#db.put('settings', mode, 'positionMode');
    this.mode = mode;
    if (mode === 'sharing') {
      this.#startWatching();
      return;
    }
    this.#stopWatching();
    if (mode === 'hidden') await this.#feed?.hidePosition();
  }

  #startWatching(): void {
    if (this.#watch !== null) return;
    this.#last = null;
    this.problem = null;
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

  #stopWatching(): void {
    if (this.#watch !== null) navigator.geolocation.clearWatch(this.#watch);
    this.#watch = null;
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
