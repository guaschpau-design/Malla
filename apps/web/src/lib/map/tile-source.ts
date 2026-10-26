// Serves map tiles to MapLibre through one protocol for every source: downloaded tiles first,
// then the network (tile-sources.ts).

import { addProtocol } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

import type { TileArchive } from './area-download.ts';
import type { TileStore } from './tile-store.ts';
import { ignArchive, TILE_SOURCES, type TileSourceId } from './tile-sources.ts';

const PROTOCOL = 'tesel-tiles';

/** Tile URL template of a source, for the map style. */
export function tileUrlTemplate(source: TileSourceId): string {
  return `${PROTOCOL}://${source}/{z}/{x}/{y}`;
}

const TILE_URL_PATTERN = new RegExp(`^${PROTOCOL}://([a-z-]+)/(\\d+)/(\\d+)/(\\d+)$`);

/** A 1 × 1 transparent PNG: what a raster source shows where it has no tile, or no network. */
const EMPTY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
).buffer;

function pmtilesArchive(url: string): TileArchive {
  const archive = new PMTiles(url);
  return {
    async getTile(z, x, y, signal) {
      return (await archive.getZxy(z, x, y, signal))?.data;
    },
  };
}

export type TileArchives = Readonly<Record<TileSourceId, TileArchive>>;

/** Where each source's tiles come from when they are not downloaded. */
export function tileArchives(basemapUrl: string): TileArchives {
  return {
    basemap: pmtilesArchive(basemapUrl),
    'ign-topo': ignArchive('ign-topo'),
    'ign-ortho': ignArchive('ign-ortho'),
  };
}

/**
 * Resolves one tile. A tile that cannot be had — no network, nothing there — resolves to nothing
 * instead of an error: offline, the map shows what is stored and leaves the rest blank.
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
  const nothing = source === 'basemap' ? new ArrayBuffer(0) : EMPTY_PNG;

  const local = await store.getTile(source, { z, x, y });
  if (local !== undefined) return local;
  try {
    return (await archives[source].getTile(z, x, y, signal)) ?? nothing;
  } catch {
    return nothing;
  }
}

export function registerTileProtocol(store: TileStore, archives: TileArchives): void {
  addProtocol(PROTOCOL, async (params, abortController) => ({
    data: await loadTile(params.url, store, archives, abortController.signal),
  }));
}
