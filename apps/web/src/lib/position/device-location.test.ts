import { describe, expect, it } from 'vitest';

import { DeviceLocation, type GeolocationSource } from './device-location.svelte.ts';

/** Stands in for the browser's geolocation: tests decide when a fix or an error arrives. */
class FakeGps implements GeolocationSource {
  watching = 0;
  #success: PositionCallback | null = null;
  #error: PositionErrorCallback | null = null;

  watchPosition(success: PositionCallback, error?: PositionErrorCallback | null): number {
    this.watching++;
    this.#success = success;
    this.#error = error ?? null;
    return this.watching;
  }

  clearWatch(): void {
    this.watching--;
  }

  fix(lat: number, lon: number): void {
    const coords = { latitude: lat, longitude: lon, accuracy: 8, heading: NaN, speed: null };
    this.#success?.({ coords, timestamp: 1_000 } as unknown as GeolocationPosition);
  }

  deny(): void {
    this.#error?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
  }
}

describe('device location', () => {
  it('runs the GPS once however many use it, and stops when the last one lets go', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const releaseMap = location.use();
    const releaseSharing = location.use();
    expect(gps.watching).toBe(1);
    releaseMap();
    releaseMap();
    expect(gps.watching).toBe(1);
    releaseSharing();
    expect(gps.watching).toBe(0);
  });

  it('hands each fix to its listeners, with unknown values as null', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const heard: unknown[] = [];
    location.use((fix) => heard.push(fix));
    gps.fix(39.47, -0.37);
    const expected = {
      at: { lat: 39.47, lon: -0.37 },
      accuracy: 8,
      heading: null,
      speed: null,
      time: 1_000,
    };
    expect(heard).toEqual([expected]);
    expect(location.fix).toEqual(expected);
  });

  it('forgets the fix and the problem when the GPS stops', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    const release = location.use();
    gps.deny();
    expect(location.problem).toBe('denied');
    gps.fix(39.47, -0.37);
    expect(location.problem).toBeNull();
    release();
    expect(location.fix).toBeNull();
  });
});
