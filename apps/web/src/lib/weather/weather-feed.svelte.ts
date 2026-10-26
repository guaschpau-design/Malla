// The official weather warnings, read from the server that serves the app (docs/protocol.md
// §8.4) every 10 minutes while the app is in view and online, and kept on the device so they are
// still there without coverage. Expired warnings drop out by themselves, minute by minute.

import { parseWeatherWarnings, weatherWarningsUrl, type WeatherWarnings } from '@tesel/protocol';

import type { AppDb } from '../storage/app-db.ts';
import { activeRegions, type ActiveRegion } from './weather-warnings.ts';

/** The server gathers them every 10 minutes. */
const REFRESH_MS = 10 * 60 * 1000;
const TICK_MS = 60 * 1000;

export class WeatherFeed {
  readonly #db: AppDb;
  readonly #url: string;
  #document: WeatherWarnings | null = $state.raw(null);
  /** The current time in seconds, moved on every minute. */
  #now = $state(Date.now() / 1000);
  #askedAt = -Infinity;
  #timer: ReturnType<typeof setInterval> | null = null;
  readonly #wake = () => {
    void this.#refresh();
  };

  /** The regions under some warning now; empty until the first warnings arrive. */
  readonly regions: readonly ActiveRegion[] = $derived(
    this.#document === null ? [] : activeRegions(this.#document, this.#now),
  );

  private constructor(db: AppDb, server: string) {
    this.#db = db;
    this.#url = weatherWarningsUrl(server);
  }

  /** Who issues the warnings, to be credited wherever they are shown. */
  get source(): string | null {
    return this.#document?.source ?? null;
  }

  /** Starts with the warnings kept on the device, then keeps them up to date until `stop`. */
  static start(db: AppDb, server: string): WeatherFeed {
    const feed = new WeatherFeed(db, server);
    void db.get('weather', 'latest').then((stored) => {
      feed.#document ??= stored ?? null;
    });
    void feed.#refresh();
    feed.#timer = setInterval(() => {
      feed.#now = Date.now() / 1000;
      void feed.#refresh();
    }, TICK_MS);
    window.addEventListener('online', feed.#wake);
    document.addEventListener('visibilitychange', feed.#wake);
    return feed;
  }

  stop(): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    window.removeEventListener('online', this.#wake);
    document.removeEventListener('visibilitychange', this.#wake);
  }

  /** Asks the server again if the last time was 10 minutes ago and anyone can see the answer. */
  async #refresh(): Promise<void> {
    if (document.hidden || !navigator.onLine || Date.now() - this.#askedAt < REFRESH_MS) return;
    this.#askedAt = Date.now();
    try {
      const response = await fetch(this.#url);
      // A server that gathers none (404), or none yet (503): nothing to show from it.
      if (!response.ok) return;
      const parsed = parseWeatherWarnings(await response.json());
      if (parsed === null) return;
      this.#document = parsed;
      await this.#db.put('weather', parsed, 'latest');
    } catch {
      // No coverage after all: what is kept stays until the next try.
    }
  }
}
