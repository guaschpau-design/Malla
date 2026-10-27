// Serves map tiles to MapLibre through one protocol for every source: downloaded tiles first,
// then the network (tile-sources.ts).

import { addProtocol } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

import type { TileArchive } from './area-download.ts';
import {
  EMPTY_RASTER_TILE,
  EMPTY_VECTOR_TILE,
  FLAT_RELIEF_TILE,
  FLAT_TERRAIN_TILE,
} from './empty-tiles.ts';
import type { TileCoord } from './tile-math.ts';
import type { TileStore } from './tile-store.ts';
import {
  contoursTileUrl,
  orthoTileUrl,
  reliefTileUrl,
  terrainTileUrl,
  TILE_SOURCES,
  webArchive,
  type TileSourceId,
} from './tile-sources.ts';

const PROTOCOL = 'tesel-tiles';

/** Tile URL template of a source, for the map style. */
export function tileUrlTemplate(source: TileSourceId): string {
  return `${PROTOCOL}://${source}/{z}/{x}/{y}`;
}

const TILE_URL_PATTERN = new RegExp(`^${PROTOCOL}://([a-z-]+)/(\\d+)/(\\d+)/(\\d+)$`);

function pmtilesArchive(url: string): TileArchive {
  const archive = new PMTiles(url);
  return {
    async getTile(z, x, y, signal) {
      return (await archive.getZxy(z, x, y, signal))?.data;
    },
  };
}

/** What each source shows where it has no tile (empty-tiles.ts). */
const NOTHING: Readonly<Record<TileSourceId, ArrayBuffer>> = {
  basemap: EMPTY_VECTOR_TILE,
  'ign-contours': EMPTY_VECTOR_TILE,
  'ign-ortho': EMPTY_RASTER_TILE,
  'ign-relief': FLAT_RELIEF_TILE,
  terrain: FLAT_TERRAIN_TILE,
};

export type TileArchives = Readonly<Record<TileSourceId, TileArchive>>;

/** Where each source's tiles come from when they are not downloaded. */
export function tileArchives(basemapUrl: string): TileArchives {
  return {
    basemap: pmtilesArchive(basemapUrl),
    'ign-contours': webArchive(contoursTileUrl),
    'ign-ortho': webArchive(orthoTileUrl),
    'ign-relief': webArchive(reliefTileUrl),
    terrain: webArchive(terrainTileUrl),
  };
}

/** One tile of a source: downloaded first, then the network; undefined if it cannot be had. */
export async function findTile(
  source: TileSourceId,
  tile: TileCoord,
  store: TileStore,
  archives: TileArchives,
  signal?: AbortSignal,
): Promise<ArrayBuffer | undefined> {
  const local = await store.getTile(source, tile);
  if (local !== undefined) return local;
  try {
    return await archives[source].getTile(
      tile.z,
      tile.x,
      tile.y,
      signal ?? new AbortController().signal,
    );
  } catch {
    return undefined;
  }
}

/**
 * Resolves one tile for the map. A tile that cannot be had — no network, nothing there — resolves
 * to the source's empty tile instead of an error: offline, the map shows what is stored and leaves
 * the rest blank.
 */
export async function loadTile(
  url: string,
  store: TileStore,
  archives: TileArchives,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const match = TILE_URL_PATTERN.exec(url);
  const source = TILE_SOURCES.find((id) => id === match?.[1]);
  if (!match || source === undefined) throw new Error(`not a ${PROTOCOL} URL: ${url}`);
  const [z, x, y] = match.slice(2).map(Number) as [number, number, number];
  return (await findTile(source, { z, x, y }, store, archives, signal)) ?? NOTHING[source];
}

export function registerTileProtocol(store: TileStore, archives: TileArchives): void {
  addProtocol(PROTOCOL, async (params, abortController) => ({
    data: await loadTile(params.url, store, archives, abortController.signal),
  }));
}
