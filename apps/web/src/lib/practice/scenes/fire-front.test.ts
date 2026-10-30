import { distanceMeters, offsetMeters } from '@tesel/core';
import { SHAPE_MAX_POINTS } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { Chance } from '../chance.ts';
import { FireFront } from './fire-front.ts';

const START = { lat: 39.47, lon: -0.37 };
const at = (north: number, east: number) => offsetMeters(START, north, east);

describe('the front of a wildfire', () => {
  // Driven south at 0.3 m/s for ten minutes, then east.
  const fire = new FireFront(
    START,
    [
      { from: 0, towards: 180, speed: 0.3 },
      { from: 600, towards: 90, speed: 0.3 },
    ],
    new Chance(5),
  );

  it('runs with the wind, and hardly against it', () => {
    expect(fire.distanceTo(at(-150, 0), 600)).toBeLessThan(0);
    expect(fire.distanceTo(at(150, 0), 600)).toBeGreaterThan(0);
    expect(fire.distanceTo(at(0, 150), 300)).toBeGreaterThan(0);
  });

  it('turns with the wind', () => {
    expect(fire.distanceTo(at(0, 150), 600)).toBeGreaterThan(0);
    expect(fire.distanceTo(at(0, 150), 1200)).toBeLessThan(0);
  });

  it('tells when it will reach a point, and that it never will', () => {
    const when = fire.reaches(at(-200, 0), 0, 1500);
    expect(when).toBeGreaterThan(400);
    expect(when).toBeLessThan(900);
    expect(fire.reaches(at(400, 0), 0, 1500)).toBeNull();
  });

  it('draws its edge as an area a shape can hold, further out when asked', () => {
    const edge = fire.edge(600);
    expect(edge.length).toBeGreaterThan(5);
    expect(edge.length).toBeLessThanOrEqual(SHAPE_MAX_POINTS);
    const reach = (points: readonly { lat: number; lon: number }[]) =>
      Math.max(...points.map((point) => distanceMeters(START, point)));
    expect(reach(fire.edge(600, 100))).toBeCloseTo(reach(edge) + 100, -1);
  });
});
