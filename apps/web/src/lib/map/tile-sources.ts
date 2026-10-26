// Where the map's tiles come from. The base vector map is our own PMTiles archive; the topographic
// map and the orthophotos are the open web map services of Spain's Instituto Geográfico Nacional
// (ADR-0023); the terrain's elevation comes from the open Terrain Tiles (ADR-0024). Every source
// is read through the same protocol, which answers from the tiles downloaded for offline use
// first (tile-source.ts).

import type { TileArchive } from './area-download.ts';

export const TILE_SOURCES = ['basemap', 'ign-topo', 'ign-ortho', 'terrain'] as const;
export type TileSourceId = (typeof TILE_SOURCES)[number];

/** The IGN layers, as their WMTS capabilities name them, in the Web Mercator tile grid. */
const IGN_LAYERS = {
  'ign-topo': { service: 'mapa-raster', layer: 'MTN' },
  'ign-ortho': { service: 'pnoa-ma', layer: 'OI.OrthoimageCoverage' },
} as const;

export type RasterSourceId = keyof typeof IGN_LAYERS;

/** Raster tiles are drawn and downloaded up to this zoom; MapLibre enlarges them beyond it. */
export const RASTER_MAX_ZOOM = 18;

/** The attribution each service asks for (its WMTS AccessConstraints, CC BY 4.0). */
export const IGN_ATTRIBUTION = {
  'ign-topo':
    '<a href="https://www.ign.es" target="_blank">CC BY 4.0 ign.es</a> · Mapa Topográfico Nacional',
  'ign-ortho': '<a href="https://www.scne.es" target="_blank">CC BY 4.0 scne.es</a> · PNOA',
} as const satisfies Readonly<Record<RasterSourceId, string>>;

export function ignTileUrl(source: RasterSourceId, z: number, x: number, y: number): string {
  const { service, layer } = IGN_LAYERS[source];
  const query = new URLSearchParams({
    request: 'GetTile',
    service: 'WMTS',
    version: '1.0.0',
    layer,
    style: 'default',
    tilematrixset: 'GoogleMapsCompatible',
    tilematrix: String(z),
    tilerow: String(y),
    tilecol: String(x),
    format: 'image/jpeg',
  });
  return `https://www.ign.es/wmts/${service}?${query.toString()}`;
}

/** The elevation data is about 30 m apart; deeper tiles would add nothing. */
export const TERRAIN_MAX_ZOOM = 12;

/**
 * Elevation tiles in the Terrarium encoding (metres = R × 256 + G + B / 256 − 32768), from the
 * Terrain Tiles open dataset. Its sources in Europe are EU-DEM (Copernicus) and SRTM.
 */
export const TERRAIN_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Terrain Tiles</a>: ' +
  'EU-DEM (Copernicus), SRTM (USGS)';

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
