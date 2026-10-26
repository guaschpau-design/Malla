// Downloads every tile of an area, from each of its sources, so the map works without a network.

import { countTiles, tilesInBounds, type Bounds } from './tile-math.ts';
import type { OfflineArea, StoredTile, TileStore } from './tile-store.ts';
import type { TileSourceId } from './tile-sources.ts';

/** Anything that can return a tile: our PMTiles archive, or a web map service. */
export interface TileArchive {
  /** Resolves to the tile bytes, or undefined if the archive has no tile there (empty area). */
  getTile(z: number, x: number, y: number, signal: AbortSignal): Promise<ArrayBuffer | undefined>;
}

/** One source to download, up to a zoom, from its archive. */
export interface DownloadLayer {
  readonly source: TileSourceId;
  readonly archive: TileArchive;
  readonly maxZoom: number;
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
  readonly layers: readonly DownloadLayer[];
  readonly signal: AbortSignal;
  readonly onProgress: (progress: DownloadProgress) => void;
  /** Requests in flight at once. */
  readonly concurrency?: number;
  /** Clock, injectable for tests. */
  readonly now?: () => number;
}

/** Largest area we let people download in one go, to protect their storage and data plan. */
export const MAX_AREA_TILES = 20_000;

const MIN_ZOOM = 0;
const WRITE_BATCH = 50;

/** How many tiles an area takes, across its sources. */
export function countAreaTiles(
  bounds: Bounds,
  layers: readonly { readonly maxZoom: number }[],
): number {
  return layers.reduce((sum, layer) => sum + countTiles(bounds, MIN_ZOOM, layer.maxZoom), 0);
}

export async function downloadArea(
  store: TileStore,
  request: DownloadRequest,
): Promise<OfflineArea> {
  const total = countAreaTiles(request.bounds, request.layers);
  if (total > MAX_AREA_TILES) {
    throw new RangeError(`area needs ${total} tiles, maximum ${MAX_AREA_TILES}`);
  }

  const base = {
    id: request.id,
    name: request.name,
    bounds: request.bounds,
    minZoom: MIN_ZOOM,
    layers: request.layers.map(({ source, maxZoom }) => ({ source, maxZoom })),
    createdAt: (request.now ?? Date.now)(),
  };
  // Saved first as incomplete, so an interrupted download is visible and can be deleted.
  await store.saveArea({ ...base, storedTiles: 0, bytes: 0, complete: false });

  let done = 0;
  let stored = 0;
  let bytes = 0;
  for (const layer of request.layers) {
    const queue = tilesInBounds(request.bounds, MIN_ZOOM, layer.maxZoom);
    let pending: StoredTile[] = [];
    const flush = async () => {
      const batch = pending;
      pending = [];
      if (batch.length > 0) await store.putTiles(request.id, layer.source, batch);
    };
    const worker = async () => {
      for (let next = queue.next(); !next.done; next = queue.next()) {
        request.signal.throwIfAborted();
        const tile = next.value;
        const data = await layer.archive.getTile(tile.z, tile.x, tile.y, request.signal);
        if (data !== undefined && data.byteLength > 0) {
          pending.push({ tile, data });
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
  }

  const area: OfflineArea = { ...base, storedTiles: stored, bytes, complete: true };
  await store.saveArea(area);
  return area;
}
