import { describe, expect, it } from 'vitest';

import type { TileArchive } from './area-download.ts';
import type { TileCoord } from './tile-math.ts';
import { loadTile, type TileArchives, type TileReader } from './tile-source.ts';
import type { TileSourceId } from './tile-sources.ts';

const stored = new Uint8Array([1]).buffer;
const remote = new Uint8Array([2]).buffer;

/** Tiles kept as seen, by source and coordinates. */
const seen: string[] = [];

const store: TileReader = {
  getTile: (source: TileSourceId, { z, x, y }: TileCoord) =>
    Promise.resolve(source === 'basemap' && `${z}/${x}/${y}` === '5/1/2' ? stored : undefined),
  keepViewed: (source: TileSourceId, { z, x, y }: TileCoord) => {
    seen.push(`${source}/${z}/${x}/${y}`);
    return Promise.resolve();
  },
};

const everywhere = (archive: TileArchive): TileArchives => ({
  basemap: {
    ...archive,
    bounds: () => Promise.resolve({ west: -10, south: 36, east: 4, north: 44 }),
  },
  'ign-names': archive,
  ortho: archive,
  terrain: archive,
});
const online = everywhere({ getTile: () => Promise.resolve(remote) });
const offline = everywhere({ getTile: () => Promise.reject(new TypeError('Failed to fetch')) });
const signal = new AbortController().signal;

describe('tile loading', () => {
  it('prefers a downloaded tile over the network', async () => {
    expect(await loadTile('tesel-tiles://basemap/5/1/2', store, online, signal)).toBe(stored);
  });

  it('falls back to the network for tiles not downloaded, and keeps them as seen', async () => {
    seen.length = 0;
    expect(await loadTile('tesel-tiles://basemap/5/1/3', store, online, signal)).toBe(remote);
    expect(await loadTile('tesel-tiles://ortho/5/1/2', store, online, signal)).toBe(remote);
    expect(seen).toEqual(['basemap/5/1/3', 'ortho/5/1/2']);
  });

  it('returns an empty tile when offline instead of failing, an image for raster sources', async () => {
    const isPng = (tile: ArrayBuffer) =>
      new Uint8Array(tile).slice(1, 4).every((byte, i) => byte === [0x50, 0x4e, 0x47][i]);
    for (const source of ['basemap', 'ign-names']) {
      const vector = await loadTile(`tesel-tiles://${source}/5/1/3`, store, offline, signal);
      expect(vector.byteLength).toBe(0);
    }
    const tiles = await Promise.all(
      ['ortho', 'terrain'].map((source) =>
        loadTile(`tesel-tiles://${source}/5/1/3`, store, offline, signal),
      ),
    );
    expect(tiles.every(isPng)).toBe(true);
    // A photograph and elevation have their own.
    expect(new Set(tiles).size).toBe(2);
  });

  it('rejects URLs that are not ours', async () => {
    await expect(loadTile('https://example.com/5/1/2', store, online, signal)).rejects.toThrow();
    await expect(loadTile('tesel-tiles://other/5/1/2', store, online, signal)).rejects.toThrow();
  });
});
