import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseWeatherWarnings } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../app.ts';
import { EnvelopeStore } from '../envelope-store.ts';
import { Relay } from '../relay.ts';
import { FEED_URLS } from './meteoalarm.ts';
import { REGIONS_LISTING_URL } from './regions.ts';
import { alert, feed, geocodes, listing, NOW_S } from './test-feeds.ts';
import { WeatherWarningsService } from './weather-warnings.ts';

/** MeteoAlarm as tests see it; counts what is asked of it. */
function meteoalarm() {
  const asked: string[] = [];
  const getJson = (url: string) => {
    asked.push(url);
    if (url === REGIONS_LISTING_URL) return Promise.resolve(listing);
    if (url.includes('Geocodes')) return Promise.resolve(geocodes);
    if (url === FEED_URLS['ES']) {
      return Promise.resolve(feed(alert({ identifier: 'a', region: 'ES521', level: 3 })));
    }
    if (url === FEED_URLS['PT']) return Promise.resolve(feed());
    return Promise.reject(new Error(`unexpected ${url}`));
  };
  return { asked, getJson };
}

const now = () => NOW_S * 1000;

describe('weather warnings service', () => {
  it('serves the warning regions as a §8.4 document', async () => {
    const service = new WeatherWarningsService({
      countries: ['ES', 'PT'],
      regionsFile: null,
      getJson: meteoalarm().getJson,
      now,
    });
    expect(service.body).toBeNull();
    await service.refresh();
    const document = parseWeatherWarnings(JSON.parse(service.body ?? 'null'));
    expect(document?.updated).toBe(NOW_S);
    expect(document?.features.map((region) => region.properties)).toMatchObject([
      { code: 'ES521', name: 'Litoral sur de Valencia', level: 3 },
    ]);
  });

  it('downloads the outlines once, and keeps them on disk across restarts', async () => {
    const regionsFile = join(mkdtempSync(join(tmpdir(), 'tesel-weather-')), 'regions.json');
    const first = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      getJson: first.getJson,
      now,
    });
    await service.refresh();
    await service.refresh();
    expect(first.asked.filter((url) => url.includes('Geocodes'))).toHaveLength(1);

    const second = meteoalarm();
    const restarted = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      getJson: second.getJson,
      now,
    });
    restarted.start();
    restarted.stop();
    await expect.poll(() => restarted.body).not.toBeNull();
    expect(second.asked.filter((url) => url.includes('Geocodes'))).toHaveLength(0);
  });

  it('keeps the last document when MeteoAlarm cannot be reached', async () => {
    let reachable = true;
    const { getJson } = meteoalarm();
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      getJson: (url) => (reachable ? getJson(url) : Promise.reject(new Error('offline'))),
      now,
    });
    await service.refresh();
    const body = service.body;
    reachable = false;
    await service.refresh();
    expect(service.body).toBe(body);
  });

  it('gathers warnings with the outlines it has when the outlines cannot be checked', async () => {
    const regionsFile = join(mkdtempSync(join(tmpdir(), 'tesel-weather-')), 'regions.json');
    const first = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      getJson: meteoalarm().getJson,
      now,
    });
    await first.refresh();

    const { getJson } = meteoalarm();
    const restarted = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile,
      getJson: (url) =>
        url === REGIONS_LISTING_URL ? Promise.reject(new Error('GitLab is down')) : getJson(url),
      now,
    });
    restarted.start();
    restarted.stop();
    await expect.poll(() => restarted.body).not.toBeNull();
  });

  it('is served to any origin, and answers 503 until gathered and 404 when off', async () => {
    const relay = new Relay(new EnvelopeStore(':memory:'), Date.now);
    const service = new WeatherWarningsService({
      countries: ['ES'],
      regionsFile: null,
      getJson: meteoalarm().getJson,
      now,
    });
    const app = await buildApp(relay, {
      webRoot: null,
      upstream: null,
      commandPost: null,
      weather: service,
    });
    expect((await app.inject('/v1/weather-warnings')).statusCode).toBe(503);
    await service.refresh();
    const response = await app.inject('/v1/weather-warnings');
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(parseWeatherWarnings(response.json())?.features).toHaveLength(1);
    await app.close();

    const off = await buildApp(relay);
    expect((await off.inject('/v1/weather-warnings')).statusCode).toBe(404);
    await off.close();
  });
});
