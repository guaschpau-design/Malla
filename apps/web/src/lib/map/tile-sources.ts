// Where the map's tiles come from. The base vector map is our own PMTiles archive; the topographic
// map and the orthophotos are the open web map services of Spain's Instituto Geográfico Nacional
// (ADR-0023). Every source is read through the same protocol, which answers from the tiles
// downloaded for offline use first (tile-source.ts).

import type { TileArchive } from './area-download.ts';

export const TILE_SOURCES = ['basemap', 'ign-topo', 'ign-ortho'] as const;
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

/** An IGN layer as a tile archive: tiles fetched from its service, or undefined if it has none. */
export function ignArchive(source: RasterSourceId): TileArchive {
  return {
    async getTile(z, x, y, signal) {
      const response = await fetch(ignTileUrl(source, z, x, y), { signal });
      if (!response.ok) return undefined;
      return response.arrayBuffer();
    },
  };
}
