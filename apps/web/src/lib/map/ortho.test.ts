import { describe, expect, it } from 'vitest';

import { FRANCE_SOUTH, PORTUGAL } from './borders-data.ts';
import { ringCoverage } from './geometry.ts';
import { lonToTileX, latToTileY, positionInTile, tileBounds } from './tile-math.ts';

/** The tile of a point at zoom 14. */
const tileAt = (lat: number, lon: number) => ({
  z: 14,
  x: lonToTileX(lon, 14),
  y: latToTileY(lat, 14),
});

const coverage = (ring: typeof PORTUGAL, lat: number, lon: number) =>
  ringCoverage(ring, tileBounds(tileAt(lat, lon)));

describe('where the satellite map takes each country’s photographs', () => {
  it('knows a tile inside Portugal, in Spain, and across their border', () => {
    expect(coverage(PORTUGAL, 38.72, -9.14)).toBe('all'); // Lisbon
    expect(coverage(PORTUGAL, 40.42, -3.7)).toBe('none'); // Madrid
    // The Minho between Tui and Valença: the border runs through the tile.
    expect(coverage(PORTUGAL, 42.03, -8.645)).toBe('part');
  });

  it('knows a tile inside France, in Spain, and across their border', () => {
    expect(coverage(FRANCE_SOUTH, 43.3, -0.37)).toBe('all'); // Pau
    expect(coverage(FRANCE_SOUTH, 42.57, -0.55)).toBe('none'); // Jaca
    // Irun and Hendaye, across the Bidasoa.
    expect(coverage(FRANCE_SOUTH, 43.355, -1.78)).toBe('part');
  });

  it('places a point within its tile, from 0 to 1 across and down', () => {
    const tile = { z: 1, x: 1, y: 1 };
    const { west, north } = tileBounds(tile);
    expect([west, north]).toEqual([0, 0]);
    const [u, v] = positionInTile([90, -66.51326], tile);
    expect(u).toBeCloseTo(0.5);
    expect(v).toBeCloseTo(0.5, 3);
  });
});
