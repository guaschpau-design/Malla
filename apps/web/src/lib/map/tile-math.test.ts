import { describe, expect, it } from 'vitest';

import { countTiles, latToTileY, lonToTileX, tileKey, tilesInBounds } from './tile-math.ts';

const valencia = { west: -0.42, south: 39.44, east: -0.33, north: 39.5 };

describe('tile arithmetic', () => {
  it('places Madrid in the right zoom-10 tile', () => {
    expect(lonToTileX(-3.7038, 10)).toBe(501);
    expect(latToTileY(40.4168, 10)).toBe(386);
  });

  it('clamps coordinates at the edges of the world', () => {
    expect(lonToTileX(180, 3)).toBe(7);
    expect(latToTileY(90, 3)).toBe(0);
    expect(latToTileY(-90, 3)).toBe(7);
  });

  it('counts exactly the tiles it lists', () => {
    expect(countTiles(valencia, 0, 14)).toBe([...tilesInBounds(valencia, 0, 14)].length);
  });

  it('includes one tile per lower zoom level for a small area', () => {
    const keys = [...tilesInBounds(valencia, 0, 3)].map(tileKey);
    expect(keys).toEqual(['0/0/0', '1/0/0', '2/1/1', '3/3/3']);
  });

  it('grows roughly fourfold per zoom level', () => {
    const at13 = countTiles(valencia, 13, 13);
    const at14 = countTiles(valencia, 14, 14);
    expect(at14 / at13).toBeGreaterThan(3);
    expect(at14 / at13).toBeLessThan(5);
  });
});
