import { describe, expect, it } from 'vitest';

import { distanceMeters, offsetMeters } from './geo.ts';
import {
  bestHeading,
  laneLines,
  lanesLength,
  stripLanes,
  sweepLanes,
  sweepPath,
  sweptFraction,
} from './sweep.ts';

const CORNER = { lat: 42.5, lon: 1.5 };
const at = (north: number, east: number) => offsetMeters(CORNER, north, east);
/** A field 100 m east to west and 400 m south to north. */
const FIELD = [CORNER, at(0, 100), at(400, 100), at(400, 0)];

describe('sweeping an area', () => {
  it('lays lanes a spacing apart, the first half a spacing in', () => {
    const { lanes } = sweepLanes(FIELD, 25, 0);
    expect(lanes.map((lane) => Math.round(lane.u))).toEqual([13, 38, 63, 88]);
    for (const lane of lanes) {
      expect(lane.spans).toHaveLength(1);
      expect(lane.spans[0]?.[0]).toBeCloseTo(0, 0);
      expect(lane.spans[0]?.[1]).toBeCloseTo(400, 0);
    }
    expect(lanesLength(sweepLanes(FIELD, 25, 0))).toBeCloseTo(1600, -1);
  });

  it('keeps one lane in an area narrower than the spacing', () => {
    expect(sweepLanes(FIELD, 500, 0).lanes.map((lane) => Math.round(lane.u))).toEqual([50]);
  });

  it('cuts a lane in two where it leaves a hollow area and comes back', () => {
    // A U, open to the north: the lane up its middle is outside the area at its foot only.
    const u = [
      CORNER,
      at(0, 90),
      at(300, 90),
      at(300, 60),
      at(100, 60),
      at(100, 30),
      at(300, 30),
      at(300, 0),
    ];
    const middle = sweepLanes(u, 10, 0).lanes.find((lane) => Math.round(lane.u) === 45);
    expect(middle?.spans).toHaveLength(1);
    const side = sweepLanes(u, 10, 90).lanes.find((lane) => Math.round(lane.u) === -205);
    expect(side?.spans).toHaveLength(2);
  });

  it('splits the lanes into strips, one after another', () => {
    const sweep = sweepLanes(FIELD, 10, 0);
    const strips = [0, 1, 2].map((strip) => stripLanes(sweep, strip, 3).lanes.length);
    expect(strips).toEqual([3, 3, 4]);
    expect(stripLanes(sweep, 1, 3).lanes[0]).toBe(sweep.lanes[3]);
  });

  it('walks a strip up one lane and down the next', () => {
    const path = sweepPath(stripLanes(sweepLanes(FIELD, 25, 0), 0, 2));
    expect(path).toHaveLength(4);
    expect(distanceMeters(path[0] ?? CORNER, at(0, 12.5))).toBeLessThan(1);
    expect(distanceMeters(path[1] ?? CORNER, at(400, 12.5))).toBeLessThan(1);
    expect(distanceMeters(path[2] ?? CORNER, at(400, 37.5))).toBeLessThan(1);
    expect(distanceMeters(path[3] ?? CORNER, at(0, 37.5))).toBeLessThan(1);
    expect(laneLines(sweepLanes(FIELD, 25, 0))).toHaveLength(4);
  });

  it('measures how much of the lanes a trail has swept', () => {
    const strip = stripLanes(sweepLanes(FIELD, 25, 0), 0, 2);
    expect(sweptFraction(strip, [], 12)).toBe(0);
    // Up the first lane, a few metres off it.
    const up = [at(0, 15), at(200, 10), at(400, 14)];
    expect(sweptFraction(strip, up, 12)).toBeCloseTo(0.5, 1);
    // And halfway down the second.
    const back = [...up, at(400, 38), at(200, 36)];
    expect(sweptFraction(strip, back, 12)).toBeCloseTo(0.75, 1);
    // Walking across the lanes sweeps next to nothing.
    expect(sweptFraction(strip, [at(200, -50), at(200, 150)], 12)).toBeLessThan(0.1);
  });

  it('runs the lanes along the area, so there are fewest', () => {
    expect(bestHeading(FIELD)).toBe(0);
    const wide = [CORNER, at(0, 400), at(100, 400), at(100, 0)];
    expect(bestHeading(wide)).toBe(90);
  });
});
