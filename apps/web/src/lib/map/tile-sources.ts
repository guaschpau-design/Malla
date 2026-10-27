// Where the map's tiles come from. The base vector map is our own PMTiles archive. The open services
// of Spain's Instituto Geográfico Nacional give the orthophotos (ADR-0023), and the contour lines,
// names of the terrain and relief shading of the topographic map (ADR-0034). The elevations the
// app measures with (line of sight, climbs) come from the open Terrain Tiles (ADR-0024). Every
// source is read through the same protocol, which answers from the tiles downloaded for offline
// use first (tile-source.ts).

import type { TileArchive } from './area-download.ts';

export const TILE_SOURCES = [
  'basemap',
  'ign-contours',
  'ign-ortho',
  'ign-relief',
  'terrain',
] as const;
export type TileSourceId = (typeof TILE_SOURCES)[number];

/** CC BY 4.0, as the services of Spain's national mapping system (SCNE) ask to be credited. */
const SCNE = '<a href="https://www.scne.es" target="_blank">CC BY 4.0 scne.es</a>';

/** The orthophotos are drawn and downloaded up to this zoom; MapLibre enlarges them beyond it. */
export const ORTHO_MAX_ZOOM = 18;

export const ORTHO_ATTRIBUTION = `${SCNE} · PNOA`;

/** PNOA orthophotos, the newest of each place, from IGN's WMTS in the Web Mercator grid. */
export function orthoTileUrl(z: number, x: number, y: number): string {
  const query = new URLSearchParams({
    request: 'GetTile',
    service: 'WMTS',
    version: '1.0.0',
    layer: 'OI.OrthoimageCoverage',
    style: 'default',
    tilematrixset: 'GoogleMapsCompatible',
    tilematrix: String(z),
    tilerow: String(y),
    tilecol: String(x),
    format: 'image/jpeg',
  });
  return `https://www.ign.es/wmts/pnoa-ma?${query.toString()}`;
}

/**
 * IGN's vector map of Spain (Mapa Base): the topographic map reads its contour lines and names of
 * the terrain. Its tiles go deeper, but the street map's last zoom holds every contour, so that an
 * area downloaded holds both to the same detail.
 */
export const CONTOURS_MAX_ZOOM = 15;

export const CONTOURS_ATTRIBUTION = `${SCNE} · Mapa Base`;

export function contoursTileUrl(z: number, x: number, y: number): string {
  return `https://vt-mapabase.idee.es/1.0.0/mapabase/${String(z)}/${String(x)}/${String(y)}.pbf`;
}

/**
 * Elevation tiles of IGN's digital terrain model, 512 pixels wide in the Mapbox Terrain-RGB
 * encoding, for the relief shading. At this zoom a pixel is about 10 m: deeper tiles shade no
 * differently, and weigh four times as much to download.
 */
export const RELIEF_MAX_ZOOM = 13;
export const RELIEF_TILE_SIZE = 512;

export const RELIEF_ATTRIBUTION = `${SCNE} · MDT`;

export function reliefTileUrl(z: number, x: number, y: number): string {
  return `https://xyz-mdt.idee.es/1.0.0/raster-dem/${String(z)}/${String(x)}/${String(y)}.png`;
}

/** The Terrain Tiles' elevations are about 30 m apart; deeper tiles would add nothing. */
export const TERRAIN_MAX_ZOOM = 12;

/**
 * Elevation tiles in the Terrarium encoding (metres = R × 256 + G + B / 256 − 32768), from the
 * Terrain Tiles open dataset. Its sources in Europe are EU-DEM (Copernicus) and SRTM.
 */
export const TERRAIN_CREDIT = 'Terrain Tiles: EU-DEM (Copernicus), SRTM (USGS)';

export function terrainTileUrl(z: number, x: number, y: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${String(z)}/${String(x)}/${String(y)}.png`;
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
