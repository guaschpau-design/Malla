import type { LatLon } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { lineOfSight, sightSamples, type Antenna } from './line-of-sight.ts';

/** Two people with radios in hand, 3 km apart along a meridian. */
const A: Antenna = { at: { lat: 39.4, lon: -0.4 }, height: 1.5 };
const B: Antenna = { at: { lat: 39.427, lon: -0.4 }, height: 1.5 };

/** Ground elevations along the way, flat at `base` but for a ridge in the middle `ridge` high. */
function ground(samples: readonly LatLon[], base: number, ridge = 0): number[] {
  const middle = Math.floor(samples.length / 2);
  return samples.map((_, index) => (Math.abs(index - middle) <= 2 ? base + ridge : base));
}

describe('line of sight', () => {
  const samples = sightSamples(A.at, B.at);

  it('samples the way about every 30 m', () => {
    expect(samples.length).toBeGreaterThan(95);
    expect(samples[0]).toEqual(A.at);
    expect(samples.at(-1)).toEqual(B.at);
  });

  it('is cut by a ridge well above the line, and says where', () => {
    const sight = lineOfSight(A, B, samples, ground(samples, 50, 40));
    expect(sight?.verdict).toBe('blocked');
    expect(sight?.worst.clearance).toBeLessThan(-30);
    expect(sight?.worst.at.lat).toBeCloseTo(39.4135, 2);
  });

  it('is only marginal over flat ground, where the signal lacks room for the Fresnel zone', () => {
    expect(lineOfSight(A, B, samples, ground(samples, 50))?.verdict).toBe('marginal');
  });

  it('is clear between two masts over a valley', () => {
    const masts = lineOfSight(
      { ...A, height: 30 },
      { ...B, height: 30 },
      samples,
      samples.map((_, index) => 50 - Math.min(index, samples.length - 1 - index)),
    );
    expect(masts?.verdict).toBe('clear');
  });

  it('cannot tell without the elevation of every sample', () => {
    const missing = ground(samples, 50).map((height, index) => (index === 10 ? null : height));
    expect(lineOfSight(A, B, samples, missing)).toBeNull();
  });
});
