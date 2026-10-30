import { distanceMeters, offsetMeters } from '@tesel/core';
import { SHAPE_MAX_POINTS } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { Chance } from '../chance.ts';
import { FloodWater } from './flood-water.ts';

const HERE = { lat: 39.47, lon: -0.37 };
const at = (north: number, east: number) => offsetMeters(HERE, north, east);
/** A stream running west to east 250 m north of here. */
const STREAM = [[at(250, -700), at(250, 700)]];

describe('the water of a flood', () => {
  const water = new FloodWater(HERE, STREAM, null, new Chance(1));

  it('rises for a quarter of an hour, holds, then falls', () => {
    const levels = [0, 300, 600, 900, 1100, 1300, 1500].map((second) => FloodWater.level(second));
    expect(levels[0]).toBeCloseTo(0.25, 5);
    expect(levels[3]).toBeCloseTo(1.5, 5);
    expect(levels[4]).toBeCloseTo(1.5, 5);
    expect(levels[1]).toBeLessThan(levels[2] ?? 0);
    expect(levels[5]).toBeLessThan(1.5);
    expect(levels[6]).toBeCloseTo(1.2, 5);
  });

  it('spreads from the stream as it rises, deeper near it', () => {
    const low = water.flooding(0.3);
    const high = water.flooding(1.5);
    expect(high.points).toBeGreaterThan(low.points * 3);
    // 150 m from the stream is dry at first, and under water at the height of the flood.
    expect(water.depthAt(at(100, 0), low)).toBe(0);
    expect(water.depthAt(at(100, 0), high)).toBeGreaterThan(0.3);
    expect(water.depthAt(at(240, 0), high)).toBeGreaterThan(water.depthAt(at(100, 0), high));
    // 350 m away, it never gets.
    expect(water.depthAt(at(-100, 0), high)).toBe(0);
  });

  it('follows the land: higher ground stays dry', () => {
    // A hill rising 3 m east of here.
    const hill = { at: (point: { lat: number; lon: number }) => (point.lon > HERE.lon ? 3 : 0) };
    const hilly = new FloodWater(HERE, STREAM, hill as never, new Chance(1));
    const flood = hilly.flooding(1.5);
    expect(hilly.depthAt(at(200, -200), flood)).toBeGreaterThan(0);
    expect(hilly.depthAt(at(200, 200), flood)).toBe(0);
  });

  it('draws its edge as an area a shape can hold, round the water', () => {
    const flood = water.flooding(1.5);
    const edge = water.edge(flood);
    expect(edge.length).toBeGreaterThan(3);
    expect(edge.length).toBeLessThanOrEqual(SHAPE_MAX_POINTS);
    // The edge runs about where the water stops: some 250 m either side of the stream.
    const south = Math.min(...edge.map((point) => point.lat));
    expect(distanceMeters(at(250, 0), { lat: south, lon: HERE.lon })).toBeGreaterThan(200);
  });
});
