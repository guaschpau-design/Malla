// Gathers the official weather warnings of some countries and keeps them ready to serve, as the
// JSON text of docs/protocol.md §8.4. Warnings are read every 10 minutes; region outlines are
// looked for once a day and downloaded only when MeteoAlarm publishes a new file, which is kept
// on disk so a restart does not download it again.

import { readFile, writeFile } from 'node:fs/promises';

import {
  highestLevel,
  WEATHER_WARNINGS_KIND,
  WEATHER_WARNINGS_VERSION,
  type WarningRegion,
  type WeatherWarnings,
} from '@tesel/protocol';

import { FEED_URLS, SOURCE, warningsByRegion } from './meteoalarm.ts';
import { newestRegionsUrl, type Region, REGIONS_LISTING_URL, regionsOf } from './regions.ts';

const WARNINGS_EVERY_MS = 10 * 60 * 1000;
const REGIONS_EVERY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60_000;

export interface WeatherWarningsOptions {
  /** ISO codes of the countries to gather, among those of FEED_URLS. */
  readonly countries: readonly string[];
  /** Where the region outlines are kept between runs, or null to keep them in memory only. */
  readonly regionsFile: string | null;
  /** Reads a JSON document; tests replace it. */
  readonly getJson?: (url: string) => Promise<unknown>;
  /** Milliseconds since the epoch. */
  readonly now?: () => number;
}

/** What the outlines file on disk holds: the outlines, the URL and the countries they are of. */
interface StoredRegions {
  readonly source: string;
  readonly countries: readonly string[];
  readonly regions: readonly (readonly [string, Region])[];
}

export class WeatherWarningsService {
  readonly #countries: readonly string[];
  readonly #regionsFile: string | null;
  readonly #getJson: (url: string) => Promise<unknown>;
  readonly #now: () => number;
  #regions = new Map<string, Region>();
  #regionsSource: string | null = null;
  #regionsCheckedAt = -Infinity;
  #body: string | null = null;
  /** The steps whose last try failed. */
  readonly #failing = new Set<string>();
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WeatherWarningsOptions) {
    this.#countries = options.countries;
    this.#regionsFile = options.regionsFile;
    this.#getJson = options.getJson ?? getJson;
    this.#now = options.now ?? Date.now;
  }

  /** The §8.4 document as JSON text, or null until the first gathering succeeds. */
  get body(): string | null {
    return this.#body;
  }

  start(): void {
    void this.#loadStoredRegions().then(() => this.refresh());
    this.#timer = setInterval(() => void this.refresh(), WARNINGS_EVERY_MS);
  }

  stop(): void {
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
  }

  /** Gathers again. A step that fails keeps what it had, and only its first failure is logged. */
  async refresh(): Promise<void> {
    if (this.#now() - this.#regionsCheckedAt >= REGIONS_EVERY_MS) {
      await this.#attempt('region outlines', () => this.#refreshRegions());
    }
    await this.#attempt('warnings', () => this.#refreshWarnings());
  }

  async #attempt(step: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
      this.#failing.delete(step);
    } catch (error) {
      if (!this.#failing.has(step)) console.warn(`Weather ${step} could not be gathered:`, error);
      this.#failing.add(step);
    }
  }

  async #refreshRegions(): Promise<void> {
    const url = newestRegionsUrl(await this.#getJson(REGIONS_LISTING_URL));
    if (url === null) throw new Error('MeteoAlarm lists no region outlines');
    this.#regionsCheckedAt = this.#now();
    if (url === this.#regionsSource) return;
    this.#regions = regionsOf(await this.#getJson(url), this.#countries);
    this.#regionsSource = url;
    await this.#storeRegions();
  }

  async #refreshWarnings(): Promise<void> {
    // Without outlines every region would be left out, as if there were no warnings.
    if (this.#regions.size === 0) throw new Error('No region outlines yet');
    const now = Math.floor(this.#now() / 1000);
    const feeds = await Promise.all(
      this.#countries.flatMap((country) => {
        const url = FEED_URLS[country];
        return url === undefined ? [] : [this.#getJson(url)];
      }),
    );
    const features: WarningRegion[] = [];
    for (const feed of feeds) {
      for (const [code, warnings] of warningsByRegion(feed, now)) {
        const region = this.#regions.get(code);
        if (region === undefined) continue;
        features.push({
          type: 'Feature',
          geometry: region.geometry,
          properties: { code, name: region.name, level: highestLevel(warnings), warnings },
        });
      }
    }
    const document: WeatherWarnings = {
      type: 'FeatureCollection',
      tesel: WEATHER_WARNINGS_KIND,
      version: WEATHER_WARNINGS_VERSION,
      updated: now,
      source: SOURCE,
      features,
    };
    this.#body = JSON.stringify(document);
  }

  async #loadStoredRegions(): Promise<void> {
    if (this.#regionsFile === null) return;
    try {
      const stored = JSON.parse(await readFile(this.#regionsFile, 'utf8')) as StoredRegions;
      if (stored.countries.join() !== this.#countries.join()) return;
      this.#regions = new Map(stored.regions);
      this.#regionsSource = stored.source;
    } catch {
      // None yet, or unreadable: the outlines are downloaded again.
    }
  }

  async #storeRegions(): Promise<void> {
    if (this.#regionsFile === null || this.#regionsSource === null) return;
    const stored: StoredRegions = {
      source: this.#regionsSource,
      countries: this.#countries,
      regions: [...this.#regions],
    };
    await writeFile(this.#regionsFile, JSON.stringify(stored));
  }
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}
