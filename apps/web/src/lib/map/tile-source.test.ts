import { describe, expect, it } from 'vitest';

import type { TileArchive } from './area-download.ts';
import { loadTile } from './tile-source.ts';
import type { TileStore } from './tile-store.ts';

const stored = new Uint8Array([1]).buffer;
const remote = new Uint8Array([2]).buffer;

const store = {
  getTile: (key: string) => Promise.resolve(key === '5/1/2' ? stored : undefined),
} as TileStore;

const online: TileArchive = { getTile: () => Promise.resolve(remote) };
const offline: TileArchive = { getTile: () => Promise.reject(new TypeError('Failed to fetch')) };
const signal = new AbortController().signal;

describe('tile loading', () => {
  it('prefers a downloaded tile over the network', async () => {
    expect(await loadTile('malla-tiles://basemap/5/1/2', store, online, signal)).toBe(stored);
  });

  it('falls back to the network for tiles not downloaded', async () => {
    expect(await loadTile('malla-tiles://basemap/5/1/3', store, online, signal)).toBe(remote);
  });

  it('returns an empty tile when offline instead of failing', async () => {
    const tile = await loadTile('malla-tiles://basemap/5/1/3', store, offline, signal);
    expect(tile.byteLength).toBe(0);
  });

  it('rejects URLs that are not ours', async () => {
    await expect(loadTile('https://example.com/5/1/2', store, online, signal)).rejects.toThrow();
  });
});
