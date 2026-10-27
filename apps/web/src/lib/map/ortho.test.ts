import { describe, expect, it } from 'vitest';

import { FRANCE_SOUTH, PORTUGAL, SPAIN, type Outline } from './borders-data.ts';
import { outlineCoverage } from './geometry.ts';
import { latToTileY, lonToTileX, positionInTile, tileBounds } from './tile-math.ts';

/** How much of the zoom-14 tile of a point an outline covers. */
const coverage = (outline: Outline, lat: number, lon: number) =>
  outlineCoverage(outline, tileBounds({ z: 14, x: lonToTileX(lon, 14), y: latToTileY(lat, 14) }));

describe('where the satellite map lays each country’s photographs', () => {
  it('knows Spain, its islands and its neighbours apart', () => {
    expect(coverage(SPAIN, 40.42, -3.7)).toBe('all'); // Madrid
    expect(coverage(SPAIN, 39.57, 2.65)).toBe('all'); // Palma
    expect(coverage(SPAIN, 28.12, -15.43)).toBe('all'); // Las Palmas
    expect(coverage(SPAIN, 38.72, -9.14)).toBe('none'); // Lisbon
  });

  it('leaves Andorra to the common mosaic', () => {
    for (const outline of [SPAIN, PORTUGAL, FRANCE_SOUTH]) {
      expect(coverage(outline, 42.508, 1.522)).toBe('none'); // Andorra la Vella
    }
  });

  it('knows a tile across a border', () => {
    expect(coverage(PORTUGAL, 38.72, -9.14)).toBe('all'); // Lisbon
    expect(coverage(PORTUGAL, 42.03, -8.645)).toBe('part'); // Tui and Valença, across the Minho
    expect(coverage(FRANCE_SOUTH, 43.3, -0.37)).toBe('all'); // Pau
    expect(coverage(FRANCE_SOUTH, 43.355, -1.78)).toBe('part'); // Irun and Hendaye
    expect(coverage(FRANCE_SOUTH, 42.57, -0.55)).toBe('none'); // Jaca
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
