import { describe, expect, it } from 'vitest';

import { deviceClock } from './device-clock.svelte.ts';

describe('device clock', () => {
  it('says nothing while the clock is right, give or take two minutes', () => {
    deviceClock.observe(1000, 1_000_000, 1_002_000);
    expect(deviceClock.offsetSeconds).toBe(1);
    expect(deviceClock.wrongByMinutes).toBeNull();
  });

  it('says how many minutes it is ahead or behind', () => {
    deviceClock.observe(1000, 1_600_000, 1_600_000);
    expect(deviceClock.wrongByMinutes).toBe(10);
    deviceClock.observe(1000, 400_000, 400_000);
    expect(deviceClock.wrongByMinutes).toBe(-10);
  });
});
