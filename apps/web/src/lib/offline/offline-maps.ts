// What a download of maps for offline use is made of: which sources, to which zoom, and roughly
// how much it weighs; and whether the areas already downloaded cover a place. Shared by the
// offline maps panel and the offer to download the operation area.

import { formatBytes } from '../format.ts';
import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
import { countAreaTiles, MAX_AREA_TILES, type DownloadLayer } from '../map/area-download.ts';
import { BASEMAP_MAX_ZOOM } from '../map/style.ts';
import { containsBounds, type Bounds } from '../map/tile-math.ts';
import type { TileArchives } from '../map/tile-source.ts';
import type { OfflineArea, TileStore } from '../map/tile-store.ts';
import { TERRAIN_MAX_ZOOM, type TileSourceId } from '../map/tile-sources.ts';
import type { DownloadFailure } from './download-job.svelte.ts';

/** Where downloaded maps are kept, and where their tiles come from. */
export interface OfflineMaps {
  readonly store: TileStore;
  readonly archives: TileArchives;
}

/** What can be downloaded as well as the street map, each from its sources. */
export const EXTRAS = ['topo', 'aerial', 'relief'] as const;
export type Extra = (typeof EXTRAS)[number];

const EXTRA_SOURCES: Readonly<Record<Extra, readonly TileSourceId[]>> = {
  // The names of the terrain, and the elevation the contour lines are worked out from.
  topo: ['ign-names', 'terrain'],
  aerial: ['ortho'],
  // For the shading and the climbs.
  relief: ['terrain'],
};

export const EXTRA_NAMES: Readonly<Record<Extra, MessageKey>> = {
  topo: 'baseMapTopo',
  aerial: 'baseMapAerial',
  relief: 'layerRelief',
};

/** The name of what each source was downloaded for. */
const SOURCE_NAMES: Readonly<Record<TileSourceId, MessageKey>> = {
  basemap: 'baseMapStreets',
  'ign-names': EXTRA_NAMES.topo,
  ortho: EXTRA_NAMES.aerial,
  terrain: EXTRA_NAMES.relief,
};

/** What an area holds, by name: the street map and each extra downloaded with it. */
export function areaContents(area: OfflineArea): MessageKey[] {
  return [...new Set(area.layers.map((layer) => SOURCE_NAMES[layer.source]))];
}

/** Rough average size of a tile of each source, only used to estimate download size. */
const AVERAGE_TILE_BYTES: Readonly<Record<TileSourceId, number>> = {
  basemap: 25 * 1024,
  'ign-names': 60 * 1024,
  ortho: 18 * 1024,
  terrain: 120 * 1024,
};

/**
 * Requests in flight at once to each source while downloading. Our own archive takes six, as many
 * as a browser opens to one host. The others are public services, free to use but not ours to
 * load: a download asks them for up to tens of thousands of tiles, and Portugal's DGT draws each
 * one on request (ortho.ts). They are asked two at a time: the download takes longer, and spreads
 * its load on them over that time.
 */
const CONCURRENCY: Readonly<Record<TileSourceId, number>> = {
  basemap: 6,
  'ign-names': 2,
  ortho: 2,
  terrain: 2,
};

/**
 * Photographs need three zooms more than the vector map for the same detail: their tiles cannot be
 * enlarged without blurring.
 */
const ORTHO_EXTRA_ZOOM = 3;

/** How deep each source is downloaded, for a street map to `maxZoom`. */
function sourceMaxZoom(source: TileSourceId, maxZoom: number): number {
  switch (source) {
    // IGN's names go as deep as the street map (tile-sources.ts).
    case 'basemap':
    case 'ign-names':
      return maxZoom;
    case 'ortho':
      return maxZoom + ORTHO_EXTRA_ZOOM;
    // Elevation is coarse: deeper tiles hold no more of it.
    case 'terrain':
      return TERRAIN_MAX_ZOOM;
  }
}

/** The layers of a download: the street map to `maxZoom`, and the sources of each extra. */
export function downloadLayers(
  archives: TileArchives,
  maxZoom: number,
  extras: readonly Extra[],
): DownloadLayer[] {
  // The topographic map and the relief share the elevation: it is downloaded once.
  const sources = new Set<TileSourceId>([
    'basemap',
    ...extras.flatMap((extra) => EXTRA_SOURCES[extra]),
  ]);
  return [...sources].map((source) => layerOf(archives, source, sourceMaxZoom(source, maxZoom)));
}

/** The layers of an area, to download again what it is missing (ADR-0056). */
export function areaLayers(archives: TileArchives, area: OfflineArea): DownloadLayer[] {
  return area.layers.map(({ source, maxZoom }) => layerOf(archives, source, maxZoom));
}

function layerOf(archives: TileArchives, source: TileSourceId, maxZoom: number): DownloadLayer {
  return { source, archive: archives[source], maxZoom, concurrency: CONCURRENCY[source] };
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

/** What to tell the user about a download that stopped short. */
export function failureText(failure: DownloadFailure, t: Translate, locale: Locale): string {
  switch (failure.kind) {
    case 'no-room':
      return t('downloadNoRoom', {
        needed: formatBytes(failure.needed, locale),
        free: formatBytes(failure.free, locale),
      });
    case 'storage-full':
      return t('downloadStorageFull');
    case 'unreachable':
      return t('downloadUnreachable');
    case 'incomplete':
      return t('downloadIncomplete');
    case 'failed':
      return t('downloadFailed');
  }
}
