// Where the map's tiles come from. The base vector map is our own PMTiles archive. The satellite
// map is a Sentinel-2 mosaic from afar and the national orthophotos of Spain, Portugal and France
// close up (ortho.ts, ADR-0023, ADR-0041). The topographic map's names of the terrain come from
// IGN's vector map of Spain (ADR-0034). Elevation, for the relief, the contour lines and every
// measure, comes from Mapterhorn (ADR-0037). Every source is read through the same protocol, which answers from the
// tiles downloaded for offline use first (tile-source.ts).

import type { TileArchive } from './area-download.ts';

export const TILE_SOURCES = ['basemap', 'ign-names', 'ortho', 'terrain'] as const;
export type TileSourceId = (typeof TILE_SOURCES)[number];

/** CC BY 4.0, as the services of Spain's national mapping system (SCNE) ask to be credited. */
export const SCNE = '<a href="https://www.scne.es" target="_blank">CC BY 4.0 scne.es</a>';

/**
 * IGN's vector map of Spain (Mapa Base): the topographic map reads its names of the terrain. Its
 * tiles go deeper, but the street map's last zoom holds them all, so that an area downloaded holds
 * both to the same detail.
 */
export const NAMES_MAX_ZOOM = 15;

export const NAMES_ATTRIBUTION = `${SCNE} · Mapa Base`;

export function namesTileUrl(z: number, x: number, y: number): string {
  return `https://vt-mapabase.idee.es/1.0.0/mapabase/${String(z)}/${String(x)}/${String(y)}.pbf`;
}

/**
 * Mapterhorn's elevation tiles: 512 pixels wide in the Terrarium encoding (metres = R × 256 + G +
 * B / 256 − 32768), built from the best open elevation models of each country (in Spain, Portugal
 * and France their national ones, from LiDAR) and Copernicus GLO-30 elsewhere. At this zoom a pixel
 * is about 10 m: deeper tiles shade and measure no differently, and weigh four times as much.
 */
export const TERRAIN_MAX_ZOOM = 13;
export const TERRAIN_TILE_SIZE = 512;

export const TERRAIN_ATTRIBUTION =
  '<a href="https://mapterhorn.com/attribution" target="_blank">© Mapterhorn</a>';

/** The same credit as plain text, for where elevations are used without a map layer. */
export const TERRAIN_CREDIT = 'Elevation: Mapterhorn (IGN, DGT, IGN France, Copernicus)';

export function terrainTileUrl(z: number, x: number, y: number): string {
  return `https://tiles.mapterhorn.com/${String(z)}/${String(x)}/${String(y)}.webp`;
}

/** A web tile service as a tile archive: undefined where it has no tile. */
export function webArchive(url: (z: number, x: number, y: number) => string): TileArchive {
  return {
    async getTile(z, x, y, signal) {
      const response = await fetch(url(z, x, y), { signal });
      if (!response.ok) return undefined;
      return response.arrayBuffer();
    },
  };
}
