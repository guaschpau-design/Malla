import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

import { tilesInBounds, type Bounds, type TileCoord } from './tile-math.ts';
import { openTileStore, type OfflineArea } from './tile-store.ts';

let dbCounter = 0;
const freshStore = () => openTileStore(`test-${String(dbCounter++)}`);

function area(id: string, bounds: Bounds): OfflineArea {
  return {
    id,
    name: id,
    bounds,
    minZoom: 10,
    layers: [{ source: 'basemap', maxZoom: 12 }],
    storedTiles: 0,
    bytes: 0,
    createdAt: Date.now(),
    complete: true,
  };
}

const tilesOf = (a: OfflineArea) =>
  [...tilesInBounds(a.bounds, a.minZoom, 12)].map((tile) => ({
    tile,
    data: new Uint8Array([tile.z, tile.x % 256, tile.y % 256]).buffer,
  }));

describe('offline tile store', () => {
  it('returns stored tiles and nothing for unknown ones', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    await store.putTiles(a.id, 'basemap', tilesOf(a));
    const [first] = tilesOf(a);
    if (first === undefined) throw new Error('no tiles');
    const read = await store.getTile('basemap', first.tile);
    expect(new Uint8Array(read ?? new ArrayBuffer(0))).toEqual(new Uint8Array(first.data));
    expect(await store.getTile('basemap', { z: 0, x: 0, y: 0 })).toBeUndefined();
    // The same coordinates of another source are another tile.
    expect(await store.getTile('ign-ortho', first.tile)).toBeUndefined();
  });

  it('keeps tiles shared with another area when one area is deleted', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    const b = area('b', { west: 2.15, south: 41.38, east: 2.3, north: 41.45 });
    for (const x of [a, b]) {
      await store.putTiles(x.id, 'basemap', tilesOf(x));
      await store.saveArea(x);
    }
    await store.deleteArea(a);

    for (const tile of tilesOf(b)) expect(await store.getTile('basemap', tile.tile)).toBeDefined();
    const same = (t: { tile: TileCoord }, u: { tile: TileCoord }) =>
      t.tile.z === u.tile.z && t.tile.x === u.tile.x && t.tile.y === u.tile.y;
    const onlyInA = tilesOf(a).filter((t) => !tilesOf(b).some((u) => same(t, u)));
    expect(onlyInA.length).toBeGreaterThan(0);
    for (const tile of onlyInA) expect(await store.getTile('basemap', tile.tile)).toBeUndefined();
    expect((await store.listAreas()).map((x) => x.id)).toEqual(['b']);
  });

  it('keeps the tiles and areas of the first version, as the base map’s', async () => {
    const name = `upgrade-${String(dbCounter++)}`;
    const old = await openDB(name, 1, {
      upgrade(database) {
        database.createObjectStore('tiles');
        database.createObjectStore('areas', { keyPath: 'id' });
      },
    });
    await old.put('tiles', { data: new Uint8Array([7]).buffer, areas: ['v'] }, '3/4/5');
    await old.put('areas', {
      id: 'v',
      name: 'v',
      bounds: { west: 2.1, south: 41.35, east: 2.2, north: 41.42 },
      minZoom: 10,
      maxZoom: 12,
      storedTiles: 1,
      bytes: 1,
      createdAt: 0,
      complete: true,
    });
    old.close();

    const store = await openTileStore(name);
    expect(await store.getTile('basemap', { z: 3, x: 4, y: 5 })).toBeDefined();
    const [upgraded] = await store.listAreas();
    expect(upgraded?.layers).toEqual([{ source: 'basemap', maxZoom: 12 }]);
    expect(upgraded).not.toHaveProperty('maxZoom');
  });
});
