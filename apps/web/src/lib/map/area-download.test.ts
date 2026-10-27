import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { downloadArea, MAX_AREA_TILES, type TileArchive } from './area-download.ts';
import { countTiles, tilesInBounds } from './tile-math.ts';
import { openTileStore } from './tile-store.ts';

let dbCounter = 0;
const freshStore = () => openTileStore(`download-${String(dbCounter++)}`);
const bounds = { west: -0.42, south: 39.44, east: -0.33, north: 39.5 };

/** Every tile exists except those with an odd x at zoom 12, which play "open sea". */
const fakeArchive: TileArchive = {
  getTile: (z, x, y) =>
    Promise.resolve(
      z === 12 && x % 2 === 1 ? undefined : new Uint8Array([z, x & 255, y & 255]).buffer,
    ),
};

describe('area download', () => {
  it('stores every non-empty tile and reports progress to the end', async () => {
    const store = await freshStore();
    const progress: number[] = [];
    const area = await downloadArea(store, {
      id: 'v',
      name: 'Valencia',
      bounds,
      layers: [
        { source: 'basemap', archive: fakeArchive, maxZoom: 12 },
        { source: 'ortho', archive: fakeArchive, maxZoom: 10 },
      ],
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p.done),
      now: () => 1000,
    });

    const total = countTiles(bounds, 0, 12) + countTiles(bounds, 0, 10);
    expect(progress.at(-1)).toBe(total);
    expect(area.complete).toBe(true);
    for (const tile of tilesInBounds(bounds, 0, 12)) {
      const stored = await store.getTile('basemap', tile);
      expect(stored === undefined).toBe(tile.z === 12 && tile.x % 2 === 1);
    }
    for (const tile of tilesInBounds(bounds, 0, 10)) {
      expect(await store.getTile('ortho', tile)).toBeDefined();
    }
    expect(await store.listAreas()).toEqual([area]);
  });

  it('leaves an incomplete area behind when cancelled', async () => {
    const store = await freshStore();
    const controller = new AbortController();
    const promise = downloadArea(store, {
      id: 'c',
      name: 'Cancelled',
      bounds,
      layers: [{ source: 'basemap', archive: fakeArchive, maxZoom: 13 }],
      signal: controller.signal,
      onProgress: (p) => {
        if (p.done === 5) controller.abort();
      },
    });
    await expect(promise).rejects.toThrow();
    const [area] = await store.listAreas();
    expect(area?.complete).toBe(false);
  });

  it('refuses areas larger than the limit', async () => {
    const store = await freshStore();
    const huge = { west: -10, south: 36, east: 4, north: 44 };
    expect(countTiles(huge, 0, 14)).toBeGreaterThan(MAX_AREA_TILES);
    await expect(
      downloadArea(store, {
        id: 'h',
        name: 'Iberia',
        bounds: huge,
        layers: [{ source: 'basemap', archive: fakeArchive, maxZoom: 14 }],
        signal: new AbortController().signal,
        onProgress: () => undefined,
      }),
    ).rejects.toThrow(RangeError);
  });
});
