import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { tileKey, tilesInBounds, type Bounds } from './tile-math.ts';
import { openTileStore, type OfflineArea } from './tile-store.ts';

let dbCounter = 0;
const freshStore = () => openTileStore(`test-${String(dbCounter++)}`);

function area(id: string, bounds: Bounds): OfflineArea {
  return {
    id,
    name: id,
    bounds,
    minZoom: 10,
    maxZoom: 12,
    storedTiles: 0,
    bytes: 0,
    createdAt: Date.now(),
    complete: true,
  };
}

const tilesOf = (a: OfflineArea) =>
  [...tilesInBounds(a.bounds, a.minZoom, a.maxZoom)].map((t) => ({
    key: tileKey(t),
    data: new Uint8Array([t.z, t.x % 256, t.y % 256]).buffer,
  }));

describe('offline tile store', () => {
  it('returns stored tiles and nothing for unknown ones', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    await store.putTiles(a.id, tilesOf(a));
    const first = tilesOf(a)[0];
    expect(new Uint8Array((await store.getTile(first?.key ?? '')) ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array(first?.data ?? new ArrayBuffer(0)),
    );
    expect(await store.getTile('0/0/0')).toBeUndefined();
  });

  it('keeps tiles shared with another area when one area is deleted', async () => {
    const store = await freshStore();
    const a = area('a', { west: 2.1, south: 41.35, east: 2.2, north: 41.42 });
    const b = area('b', { west: 2.15, south: 41.38, east: 2.3, north: 41.45 });
    for (const x of [a, b]) {
      await store.putTiles(x.id, tilesOf(x));
      await store.saveArea(x);
    }
    await store.deleteArea(a);

    for (const tile of tilesOf(b)) expect(await store.getTile(tile.key)).toBeDefined();
    const onlyInA = tilesOf(a).filter((t) => !tilesOf(b).some((u) => u.key === t.key));
    expect(onlyInA.length).toBeGreaterThan(0);
    for (const tile of onlyInA) expect(await store.getTile(tile.key)).toBeUndefined();
    expect((await store.listAreas()).map((x) => x.id)).toEqual(['b']);
  });
});
