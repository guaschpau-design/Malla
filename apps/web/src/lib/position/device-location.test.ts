import { describe, expect, it } from 'vitest';

import { DeviceLocation } from './device-location.svelte.ts';
import { FakeGps } from './fake-gps.ts';

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

  it('hands a newcomer the fix the GPS already has', () => {
    const gps = new FakeGps();
    const location = new DeviceLocation(gps);
    location.use();
    gps.fix(39.47, -0.37);
    const heard: unknown[] = [];
    location.use((fix) => heard.push(fix));
    expect(heard).toHaveLength(1);
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
