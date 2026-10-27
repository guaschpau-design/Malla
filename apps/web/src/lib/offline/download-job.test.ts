import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TileArchive } from '../map/area-download.ts';
import { openTileStore } from '../map/tile-store.ts';
import { DownloadJob, type DownloadPlan } from './download-job.svelte.ts';

let databases = 0;
const freshStore = () => openTileStore(`download-job-${String(++databases)}`);

const bounds = { west: -0.42, south: 39.44, east: -0.33, north: 39.5 };
const tile = new Uint8Array([1, 2, 3]).buffer;

const everyTile: TileArchive = { getTile: () => Promise.resolve(tile) };
const brokenService: TileArchive = { getTile: () => Promise.reject(new Error('503')) };

function plan(archive: TileArchive): DownloadPlan {
  return {
    name: 'Valencia',
    bounds,
    layers: [{ source: 'basemap', archive, maxZoom: 10, concurrency: 2 }],
  };
}

describe('a download of an area', () => {
  beforeEach(() => {
    // The browser's storage manager, which the job asks to keep the tiles.
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(true) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows its progress to the end and keeps the whole area', async () => {
    const store = await freshStore();
    const job = new DownloadJob();
    const running = job.run(store, plan(everyTile));
    expect(job.running).toBe(true);
    expect(job.progress?.done).toBe(0);
    const total = job.progress?.total ?? 0;
    expect(total).toBeGreaterThan(0);

    await expect(running).resolves.toBe(true);
    expect(job.running).toBe(false);
    expect(job.failed).toBe(false);
    const [area] = await store.listAreas();
    expect(area).toMatchObject({ name: 'Valencia', complete: true, storedTiles: total });
  });

  it('says it failed when a service does not answer, and never rejects', async () => {
    const job = new DownloadJob();
    await expect(job.run(await freshStore(), plan(brokenService))).resolves.toBe(false);
    expect(job.failed).toBe(true);
    expect(job.running).toBe(false);
  });

  it('stops when cancelled, without calling it a failure', async () => {
    const store = await freshStore();
    const job = new DownloadJob();
    const running = job.run(store, plan(everyTile));
    job.cancel();
    await expect(running).resolves.toBe(false);
    expect(job.failed).toBe(false);
    const [area] = await store.listAreas();
    expect(area?.complete).toBe(false);
  });
});
