import { distanceMeters, offsetMeters, pathMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { plan, type Scenario } from './scenario.ts';
import { onFoot, WalkNetwork } from './walkways.ts';

const CORNER = { lat: 39.47, lon: -0.38 };
/** A point `north` and `east` metres from the corner. */
const at = (north: number, east: number): LatLon => offsetMeters(CORNER, north, east);

/**
 * Three streets each way, 100 m apart: a grid of four blocks, 200 m by 200 m. The buildings are
 * the blocks between the streets.
 */
const GRID: LatLon[][] = [0, 100, 200].flatMap((offset) => [
  [at(offset, 0), at(offset, 100), at(offset, 200)],
  [at(0, offset), at(100, offset), at(200, offset)],
]);

describe('walking the streets', () => {
  const network = WalkNetwork.from(GRID);
  if (network === null) throw new Error('no network');

  it('takes the streets round a block, never through it', () => {
    // From one corner of a block to the opposite one: 200 m round it, not 141 m across.
    const way = network.way(at(0, 0), at(100, 100));
    expect(pathMeters(way)).toBeCloseTo(200, 0);
    for (const point of way) {
      const onAStreet = [0, 100, 200].some(
        (offset) =>
          distanceMeters(point, { lat: at(offset, 0).lat, lon: point.lon }) < 0.5 ||
          distanceMeters(point, { lat: point.lat, lon: at(0, offset).lon }) < 0.5,
      );
      expect(onAStreet).toBe(true);
    }
  });

  it('steps onto the nearest street from inside a block', () => {
    // 30 m north and 45 m east of the corner, in the first block: the nearest street is the
    // southern one, 30 m away.
    expect(distanceMeters(network.snap(at(30, 45)), at(0, 45))).toBeLessThan(0.5);
  });

  it('starts and ends where each point meets the network, mid-street too', () => {
    const way = network.way(at(5, 50), at(195, 150));
    expect(distanceMeters(way[0] ?? CORNER, at(0, 50))).toBeLessThan(0.5);
    expect(distanceMeters(way.at(-1) ?? CORNER, at(200, 150))).toBeLessThan(0.5);
    expect(pathMeters(way)).toBeCloseTo(300, 0);
  });

  it('joins a street cut where two tiles of the map meet', () => {
    // One street drawn in two pieces that overlap without sharing a point, as at a tile's edge,
    // and a side street that stops at its kerb.
    const pieces = WalkNetwork.from([
      [at(0, 0), at(0, 120)],
      [at(0, 110.3), at(0, 250)],
      [at(80, 200), at(3, 200)],
    ]);
    expect(pathMeters(pieces?.way(at(0, 0), at(80, 200)) ?? [])).toBeCloseTo(280, 0);
  });

  it('keeps only the largest connected part', () => {
    // A path on its own, far from the grid, cannot be reached on foot: it is left out.
    const withIsland = WalkNetwork.from([...GRID, [at(600, 600), at(600, 700)]]);
    expect(withIsland?.length).toBeCloseTo(1200, 0);
    expect(distanceMeters(withIsland?.snap(at(600, 650)) ?? CORNER, at(200, 200))).toBeLessThan(1);
  });

  it('is no network without lines', () => {
    expect(WalkNetwork.from([])).toBeNull();
  });
});

describe('the streets of a town', () => {
  // 31 streets each way, 50 m apart, drawn with a point every 10 m as a map does, and three side
  // streets in each block that stop 2 m short of the next street: some 10 000 segments.
  const streets = Array.from({ length: 31 }, (_, offset) => {
    const along = Array.from({ length: 151 }, (__, step) => step * 10);
    return [
      along.map((meters) => at(offset * 50, meters)),
      along.map((meters) => at(meters, offset * 50)),
    ];
  }).flat();
  const sideStreets = Array.from({ length: 30 * 30 * 3 }, (_, index) => {
    const [block, side] = [Math.floor(index / 3), index % 3];
    const [north, east] = [Math.floor(block / 30) * 50, (block % 30) * 50 + 12 + side * 12];
    return [at(north + 20, east), at(north + 48, east)];
  });
  const lines = [...streets, ...sideStreets];

  it('is put together, and searched, in a moment', () => {
    const started = performance.now();
    const town = WalkNetwork.from(lines);
    const built = performance.now();
    for (let walk = 0; walk < 20; walk += 1) town?.way(at(1, walk), at(1499, 1499 - walk));
    const searched = performance.now();
    expect(town?.length).toBeCloseTo(31 * 2 * 1500 + 30 * 30 * 3 * 30, -1);
    expect(built - started).toBeLessThan(1000);
    expect((searched - built) / 20).toBeLessThan(50);
  });
});

describe('a scenario on foot', () => {
  const network = WalkNetwork.from(GRID);
  if (network === null) throw new Error('no network');
  const scenario: Scenario = {
    name: 'grid',
    description: 'Two members in a grid of streets.',
    center: at(100, 100),
    duration: 600,
    members: [
      // Across two blocks, as the crow flies.
      { alias: 'Walker', route: [at(10, 10), at(190, 190)], speed: 1 },
      // In the middle of a block.
      { alias: 'Stander', route: [at(50, 140)] },
    ],
    steps: [
      {
        at: 5,
        by: 'Stander',
        action: { type: 'marker', id: 'cut', symbol: 1, label: 'Cortado', where: at(150, 60) },
      },
      {
        at: 6,
        by: 'Stander',
        action: {
          type: 'shape',
          id: 'way-out',
          style: 5,
          label: 'Evacuación',
          // Straight across the blocks, as if drawn without looking.
          geometry: { kind: 'polyline', points: [at(0, 0), at(200, 200)] },
        },
      },
    ],
  };
  const walked = onFoot(scenario, network);

  it('has every member on a street at every position they report', () => {
    for (const event of plan(walked, { positionEvery: 5 })) {
      if (event.action.type !== 'position') continue;
      const { where } = event.action;
      expect(distanceMeters(network.snap(where), where)).toBeLessThan(0.5);
    }
  });

  it('walks round the blocks between the points of a route', () => {
    // From the street 10 m from the first point to the one 10 m from the second: 200 m one way
    // and 180 m the other, round the blocks.
    const route = walked.members[0]?.route ?? [];
    expect(pathMeters(route)).toBeCloseTo(380, 0);
  });

  it('draws a route along the streets', () => {
    const shape = walked.steps[1]?.action;
    const points = shape?.type === 'shape' ? shape.geometry : null;
    expect(points?.kind === 'polyline' && pathMeters(points.points)).toBeCloseTo(400, 0);
  });

  it('puts a marker on the nearest street', () => {
    const marker = walked.steps[0]?.action;
    expect(marker?.type === 'marker' && distanceMeters(marker.where, at(150, 100))).toBeLessThan(
      0.5,
    );
  });
});
