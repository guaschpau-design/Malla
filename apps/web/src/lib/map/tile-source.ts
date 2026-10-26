// Serves map tiles to MapLibre: downloaded tiles first, then the network.

import { addProtocol } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

import type { TileArchive } from './area-download.ts';
import type { TileStore } from './tile-store.ts';

const PROTOCOL = 'tesel-tiles';

/** Tile URL template used by the map style. */
export const TILE_URL_TEMPLATE = `${PROTOCOL}://basemap/{z}/{x}/{y}`;

const TILE_URL_PATTERN = new RegExp(`^${PROTOCOL}://basemap/(\\d+)/(\\d+)/(\\d+)$`);

export function pmtilesArchive(url: string): TileArchive {
  const archive = new PMTiles(url);
  return {
    async getTile(z, x, y, signal) {
      return (await archive.getZxy(z, x, y, signal))?.data;
    },
  };
}

/**
 * Resolves one tile. A failed network request resolves to an empty tile instead of an error:
 * offline, the map shows what is stored and leaves the rest blank.
 */
export async function loadTile(
  url: string,
  store: TileStore,
  archive: TileArchive,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const match = TILE_URL_PATTERN.exec(url);
  if (!match) throw new Error(`not a ${PROTOCOL} URL: ${url}`);
  const [z, x, y] = match.slice(1).map(Number) as [number, number, number];

  const local = await store.getTile(`${z}/${x}/${y}`);
  if (local !== undefined) return local;
  try {
    return (await archive.getTile(z, x, y, signal)) ?? new ArrayBuffer(0);
  } catch {
    return new ArrayBuffer(0);
  }
}

export function registerTileProtocol(store: TileStore, archive: TileArchive): void {
  addProtocol(PROTOCOL, async (params, abortController) => ({
    data: await loadTile(params.url, store, archive, abortController.signal),
  }));
}
