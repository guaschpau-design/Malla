import { distanceMeters, offsetMeters } from '@tesel/core';
import { describe, expect, it } from 'vitest';

import { simplifyLine } from './simplify.ts';

const ORIGIN = { lat: 42.5, lon: 1.5 };

/** A zigzag of `count` points, `width` metres to each side of a line heading east. */
function zigzag(count: number, width: number) {
  return Array.from({ length: count }, (_, index) =>
    offsetMeters(ORIGIN, index % 2 === 0 ? width : -width, index * 50),
  );
}

describe('simplifying a line', () => {
  it('keeps a line that already fits as it is', () => {
    const line = zigzag(10, 30);
    expect(simplifyLine(line, 25)).toEqual({ points: line, deviation: 0 });
  });

  it('keeps the ends and the corners, and drops points in between', () => {
    // An L: 200 points east, then 200 north.
    const east = Array.from({ length: 200 }, (_, index) => offsetMeters(ORIGIN, 0, index * 10));
    const corner = offsetMeters(ORIGIN, 0, 2000);
    const north = Array.from({ length: 200 }, (_, index) => offsetMeters(corner, index * 10, 0));
    const line = [...east, ...north];
    const { points, deviation } = simplifyLine(line, 25);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual(line[0]);
    expect(points.at(-1)).toEqual(line.at(-1));
    expect(distanceMeters(points[1] ?? ORIGIN, corner)).toBeLessThan(11);
    expect(deviation).toBeLessThan(1);
  });

  it('uses all the points it may, and says how far the line strays', () => {
    const { points, deviation } = simplifyLine(zigzag(1000, 20), 25);
    expect(points).toHaveLength(25);
    expect(deviation).toBeGreaterThan(30);
    expect(deviation).toBeLessThan(45);
  });

  it('splits a straight stretch too long for one step of a shape', () => {
    // A straight line 1° of longitude long, in 1000 points: two would do but for the steps.
    const line = Array.from({ length: 1000 }, (_, index) => ({
      lat: ORIGIN.lat,
      lon: ORIGIN.lon + index / 1000,
    }));
    const { points } = simplifyLine(line, 25);
    for (let index = 1; index < points.length; index++) {
      const step = Math.abs((points[index]?.lon ?? 0) - (points[index - 1]?.lon ?? 0));
      expect(step).toBeLessThanOrEqual(0.3);
    }
  });
});
