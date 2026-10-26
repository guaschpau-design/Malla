import { describe, expect, it } from 'vitest';

import type { TileArchive } from './area-download.ts';
import type { TileCoord } from './tile-math.ts';
import { loadTile, type TileArchives } from './tile-source.ts';
import type { TileStore } from './tile-store.ts';
import type { TileSourceId } from './tile-sources.ts';

const stored = new Uint8Array([1]).buffer;
const remote = new Uint8Array([2]).buffer;

const store = {
  getTile: (source: TileSourceId, { z, x, y }: TileCoord) =>
    Promise.resolve(source === 'basemap' && `${z}/${x}/${y}` === '5/1/2' ? stored : undefined),
} as TileStore;

const everywhere = (archive: TileArchive): TileArchives => ({
  basemap: archive,
  'ign-topo': archive,
  'ign-ortho': archive,
  terrain: archive,
});
const online = everywhere({ getTile: () => Promise.resolve(remote) });
const offline = everywhere({ getTile: () => Promise.reject(new TypeError('Failed to fetch')) });
const signal = new AbortController().signal;

describe('tile loading', () => {
  it('prefers a downloaded tile over the network', async () => {
    expect(await loadTile('tesel-tiles://basemap/5/1/2', store, online, signal)).toBe(stored);
  });

  it('falls back to the network for tiles not downloaded, of the source asked for', async () => {
    expect(await loadTile('tesel-tiles://basemap/5/1/3', store, online, signal)).toBe(remote);
    expect(await loadTile('tesel-tiles://ign-ortho/5/1/2', store, online, signal)).toBe(remote);
  });

  it('returns an empty tile when offline instead of failing, an image for raster sources', async () => {
    const vector = await loadTile('tesel-tiles://basemap/5/1/3', store, offline, signal);
    expect(vector.byteLength).toBe(0);
    const raster = await loadTile('tesel-tiles://ign-topo/5/1/3', store, offline, signal);
    expect(new Uint8Array(raster).slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
    const terrain = await loadTile('tesel-tiles://terrain/5/1/3', store, offline, signal);
    expect(terrain).not.toBe(raster);
    expect(new Uint8Array(terrain).slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
  });

  it('rejects URLs that are not ours', async () => {
    await expect(loadTile('https://example.com/5/1/2', store, online, signal)).rejects.toThrow();
    await expect(loadTile('tesel-tiles://other/5/1/2', store, online, signal)).rejects.toThrow();
  });
});
