// MapLibre styles for each base map: the Protomaps OpenStreetMap map in the app's theme, the IGN
// topographic map, or the IGN orthophotos with our labels over them. All served through our tile
// protocol (tile-source.ts), so downloaded areas work offline whichever is shown.

import { layers, namedFlavor } from '@protomaps/basemaps';
import type {
  HillshadeLayerSpecification,
  RasterDEMSourceSpecification,
  RasterLayerSpecification,
  RasterSourceSpecification,
  StyleSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';

import { themeColor } from '../ui/theme.ts';
import { tileUrlTemplate } from './tile-source.ts';
import {
  IGN_ATTRIBUTION,
  RASTER_MAX_ZOOM,
  TERRAIN_ATTRIBUTION,
  TERRAIN_MAX_ZOOM,
  type RasterSourceId,
} from './tile-sources.ts';

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

export interface StyleChoice {
  readonly base: BaseMap;
  /** Shading of the terrain, over the base map and under its names. */
  readonly relief: boolean;
  readonly theme: MapTheme;
  readonly lang: string;
}

export function buildStyle(choice: StyleChoice, assetsUrl: string): StyleSpecification {
  return withRelief(baseStyle(choice, assetsUrl), choice);
}

function baseStyle({ base, theme, lang }: StyleChoice, assetsUrl: string): StyleSpecification {
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

/** Adds the shading of the terrain under the first layer of names, if asked for. */
function withRelief(style: StyleSpecification, { relief, theme }: StyleChoice): StyleSpecification {
  if (!relief) return style;
  const terrain: RasterDEMSourceSpecification = {
    type: 'raster-dem',
    tiles: [tileUrlTemplate('terrain')],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: TERRAIN_MAX_ZOOM,
    attribution: TERRAIN_ATTRIBUTION,
  };
  const shading: HillshadeLayerSpecification = {
    id: 'relief',
    type: 'hillshade',
    source: 'terrain',
    paint: {
      'hillshade-exaggeration': theme === 'dark' ? 0.35 : 0.45,
      'hillshade-shadow-color': themeColor('map-relief'),
    },
  };
  const firstName = style.layers.findIndex((layer) => layer.type === 'symbol');
  const at = firstName === -1 ? style.layers.length : firstName;
  return {
    ...style,
    sources: { ...style.sources, terrain },
    layers: [...style.layers.slice(0, at), shading, ...style.layers.slice(at)],
  };
}
