// What a download of maps for offline use is made of: which sources, to which zoom, and roughly
// how much it weighs; and whether the areas already downloaded cover a place. Shared by the
// offline maps panel and the offer to download the operation area.

import type { MessageKey } from '../i18n/index.ts';
import { countAreaTiles, MAX_AREA_TILES, type DownloadLayer } from '../map/area-download.ts';
import { BASEMAP_MAX_ZOOM } from '../map/style.ts';
import { containsBounds, type Bounds } from '../map/tile-math.ts';
import type { TileArchives } from '../map/tile-source.ts';
import type { OfflineArea, TileStore } from '../map/tile-store.ts';
import { TERRAIN_MAX_ZOOM, type TileSourceId } from '../map/tile-sources.ts';

/** Where downloaded maps are kept, and where their tiles come from. */
export interface OfflineMaps {
  readonly store: TileStore;
  readonly archives: TileArchives;
}

/** What can be downloaded as well as the street map. */
export type ExtraSource = Exclude<TileSourceId, 'basemap'>;
export const EXTRA_SOURCES: readonly ExtraSource[] = ['ign-topo', 'ign-ortho', 'terrain'];

export const SOURCE_NAMES: Readonly<Record<TileSourceId, MessageKey>> = {
  basemap: 'baseMapStreets',
  'ign-topo': 'baseMapTopo',
  'ign-ortho': 'baseMapAerial',
  terrain: 'layerRelief',
};

/** Rough average size of a tile of each source, only used to estimate download size. */
const AVERAGE_TILE_BYTES: Readonly<Record<TileSourceId, number>> = {
  basemap: 25 * 1024,
  'ign-topo': 18 * 1024,
  'ign-ortho': 18 * 1024,
  terrain: 110 * 1024,
};

/**
 * Photographs and topographic maps need three zooms more than the vector map for the same detail:
 * their tiles cannot be enlarged without blurring.
 */
const RASTER_EXTRA_ZOOM = 3;

/** The layers of a download: the street map to `maxZoom`, and each extra to its matching zoom. */
export function downloadLayers(
  archives: TileArchives,
  maxZoom: number,
  extras: readonly ExtraSource[],
): DownloadLayer[] {
  return [
    { source: 'basemap', archive: archives.basemap, maxZoom },
    ...extras.map((source) => ({
      source,
      archive: archives[source],
      // Elevation is coarse: deeper tiles hold no more of it.
      maxZoom: source === 'terrain' ? TERRAIN_MAX_ZOOM : maxZoom + RASTER_EXTRA_ZOOM,
    })),
  ];
}

export function estimatedBytes(bounds: Bounds, layers: readonly DownloadLayer[]): number {
  return layers.reduce(
    (sum, layer) => sum + countAreaTiles(bounds, [layer]) * AVERAGE_TILE_BYTES[layer.source],
    0,
  );
}

/**
 * The most detailed street map of `bounds` that fits in one download, or null if not even the
 * least detailed does.
 */
export function detailThatFits(bounds: Bounds, lowestZoom: number): number | null {
  for (let zoom = BASEMAP_MAX_ZOOM; zoom >= lowestZoom; zoom--) {
    if (countAreaTiles(bounds, [{ maxZoom: zoom }]) <= MAX_AREA_TILES) return zoom;
  }
  return null;
}

/** Whether a complete downloaded area already holds the street map of `bounds`. */
export function isDownloaded(areas: readonly OfflineArea[], bounds: Bounds): boolean {
  return areas.some(
    (area) =>
      area.complete &&
      containsBounds(area.bounds, bounds) &&
      area.layers.some((layer) => layer.source === 'basemap'),
  );
}
