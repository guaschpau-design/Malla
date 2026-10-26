// MapLibre styles for each base map: the Protomaps OpenStreetMap map in the app's theme, the IGN
// topographic map, or the IGN orthophotos with our labels over them. All served through our tile
// protocol (tile-source.ts), so downloaded areas work offline whichever is shown.

import { layers, namedFlavor } from '@protomaps/basemaps';
import type {
  RasterLayerSpecification,
  RasterSourceSpecification,
  StyleSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';

import { tileUrlTemplate } from './tile-source.ts';
import { IGN_ATTRIBUTION, RASTER_MAX_ZOOM, type RasterSourceId } from './tile-sources.ts';

export type MapTheme = 'light' | 'dark';

export const BASE_MAPS = ['streets', 'topo', 'aerial'] as const;
export type BaseMap = (typeof BASE_MAPS)[number];

/** Highest zoom of the vector base map we download and request; MapLibre over-zooms beyond it. */
export const BASEMAP_MAX_ZOOM = 14;

const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · ' +
  '<a href="https://protomaps.com" target="_blank">Protomaps</a>';

/** The raster source under each base map, if any. */
export const BASE_MAP_RASTER: Readonly<Record<BaseMap, RasterSourceId | null>> = {
  streets: null,
  topo: 'ign-topo',
  aerial: 'ign-ortho',
};

export function buildStyle(
  base: BaseMap,
  theme: MapTheme,
  lang: string,
  assetsUrl: string,
): StyleSpecification {
  // Labels over photographs read best light on dark, whatever the app's theme.
  const flavor = base === 'aerial' ? 'dark' : theme;
  const vector: VectorSourceSpecification = {
    type: 'vector',
    tiles: [tileUrlTemplate('basemap')],
    maxzoom: BASEMAP_MAX_ZOOM,
    attribution: OSM_ATTRIBUTION,
  };
  const common = {
    version: 8,
    glyphs: `${assetsUrl}fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsUrl}sprites/${flavor}`,
  } as const;
  const raster = BASE_MAP_RASTER[base];
  if (raster === null) {
    return {
      ...common,
      sources: { protomaps: vector },
      layers: layers('protomaps', namedFlavor(theme), { lang }),
    };
  }
  const rasterSource: RasterSourceSpecification = {
    type: 'raster',
    tiles: [tileUrlTemplate(raster)],
    tileSize: 256,
    maxzoom: RASTER_MAX_ZOOM,
    attribution: IGN_ATTRIBUTION[raster],
  };
  const rasterLayer: RasterLayerSpecification = { id: raster, type: 'raster', source: raster };
  // The topographic map carries its own names; the photographs get ours.
  if (base === 'topo')
    return { ...common, sources: { [raster]: rasterSource }, layers: [rasterLayer] };
  return {
    ...common,
    sources: { [raster]: rasterSource, protomaps: vector },
    layers: [rasterLayer, ...layers('protomaps', namedFlavor(flavor), { lang, labelsOnly: true })],
  };
}
