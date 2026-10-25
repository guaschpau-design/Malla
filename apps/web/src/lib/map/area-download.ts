// Downloads every tile of an area so the map works without a network.

import { tileKey, tilesInBounds, countTiles, type Bounds } from './tile-math.ts';
import type { OfflineArea, StoredTile, TileStore } from './tile-store.ts';

/** Anything that can return a tile; in production a PMTiles archive. */
export interface TileArchive {
  /** Resolves to the tile bytes, or undefined if the archive has no tile there (empty area). */
  getTile(z: number, x: number, y: number, signal: AbortSignal): Promise<ArrayBuffer | undefined>;
}

export interface DownloadProgress {
  readonly done: number;
  readonly total: number;
  readonly bytes: number;
}

export interface DownloadRequest {
  readonly id: string;
  readonly name: string;
  readonly bounds: Bounds;
  readonly maxZoom: number;
  readonly signal: AbortSignal;
  readonly onProgress: (progress: DownloadProgress) => void;
  /** Requests in flight at once. */
  readonly concurrency?: number;
  /** Clock, injectable for tests. */
  readonly now?: () => number;
}

/** Largest area we let people download in one go, to protect their storage and data plan. */
export const MAX_AREA_TILES = 20_000;

const WRITE_BATCH = 50;

export async function downloadArea(
  archive: TileArchive,
  store: TileStore,
  request: DownloadRequest,
): Promise<OfflineArea> {
  const minZoom = 0;
  const total = countTiles(request.bounds, minZoom, request.maxZoom);
  if (total > MAX_AREA_TILES) {
    throw new RangeError(`area needs ${total} tiles, maximum ${MAX_AREA_TILES}`);
  }

  const base = {
    id: request.id,
    name: request.name,
    bounds: request.bounds,
    minZoom,
    maxZoom: request.maxZoom,
    createdAt: (request.now ?? Date.now)(),
  };
  // Saved first as incomplete, so an interrupted download is visible and can be deleted.
  await store.saveArea({ ...base, storedTiles: 0, bytes: 0, complete: false });

  const queue = tilesInBounds(request.bounds, minZoom, request.maxZoom);
  let pending: StoredTile[] = [];
  let done = 0;
  let stored = 0;
  let bytes = 0;

  const flush = async () => {
    const batch = pending;
    pending = [];
    if (batch.length > 0) await store.putTiles(request.id, batch);
  };

  const worker = async () => {
    for (let next = queue.next(); !next.done; next = queue.next()) {
      request.signal.throwIfAborted();
      const { z, x, y } = next.value;
      const data = await archive.getTile(z, x, y, request.signal);
      if (data !== undefined && data.byteLength > 0) {
        pending.push({ key: tileKey(next.value), data });
        stored++;
        bytes += data.byteLength;
        if (pending.length >= WRITE_BATCH) await flush();
      }
      done++;
      request.onProgress({ done, total, bytes });
    }
  };

  await Promise.all(Array.from({ length: request.concurrency ?? 6 }, worker));
  await flush();

  const area: OfflineArea = { ...base, storedTiles: stored, bytes, complete: true };
  await store.saveArea(area);
  return area;
}
