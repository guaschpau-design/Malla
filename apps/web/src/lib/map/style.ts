// MapLibre styles for each base map: the Protomaps OpenStreetMap map in the app's theme; the same
// map as a topographic map, with IGN's contour lines and names of the terrain (topo.ts); or the
// IGN orthophotos with our labels over them. All served through our tile protocol
// (tile-source.ts), so downloaded areas work offline whichever is shown.

import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type {
  HillshadeLayerSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import { themeColor } from '../ui/theme.ts';
import { tileUrlTemplate } from './tile-source.ts';
import {
  CONTOURS_ATTRIBUTION,
  CONTOURS_MAX_ZOOM,
  ORTHO_ATTRIBUTION,
  ORTHO_MAX_ZOOM,
  RELIEF_ATTRIBUTION,
  RELIEF_MAX_ZOOM,
  RELIEF_TILE_SIZE,
} from './tile-sources.ts';
import { CONTOURS_SOURCE, contourLayers, terrainNameLayers, topoFlavor } from './topo.ts';

export type MapTheme = 'light' | 'dark';

export const BASE_MAPS = ['streets', 'topo', 'aerial'] as const;
export type BaseMap = (typeof BASE_MAPS)[number];

/**
 * Highest zoom of the vector base map we download and request; MapLibre over-zooms beyond it. It
 * is the last level of the Protomaps builds, the only one that holds every point of interest:
 * pharmacies, most police stations and doctors are not in the levels above.
 */
export const BASEMAP_MAX_ZOOM = 15;

/** The style's name for the vector base map, in the Protomaps schema. Every style has it. */
export const BASEMAP_SOURCE = 'protomaps';

const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · ' +
  '<a href="https://protomaps.com" target="_blank">Protomaps</a>';

const ORTHO_SOURCE = 'ign-ortho';
const RELIEF_SOURCE = 'ign-relief';

export interface StyleChoice {
  readonly base: BaseMap;
  /** Shading of the terrain, over the base map's ground and under its lines and names. */
  readonly relief: boolean;
  readonly theme: MapTheme;
  readonly lang: string;
}

/** A base map in three bands, so that the relief shading can go between the first two. */
interface BaseMapLayers {
  readonly sources: Readonly<Record<string, SourceSpecification>>;
  /** What the relief shades: land, water, roads. */
  readonly ground: LayerSpecification[];
  /** Lines drawn over the shading. */
  readonly lines: LayerSpecification[];
  readonly names: LayerSpecification[];
}

export function buildStyle(choice: StyleChoice, assetsUrl: string): StyleSpecification {
  const { sources, ground, lines, names } = baseMapLayers(choice);
  const relief = choice.relief ? reliefShading(choice.theme) : null;
  // Labels over photographs read best light on dark, whatever the app's theme.
  const sprite = choice.base === 'aerial' ? 'dark' : choice.theme;
  return {
    version: 8,
    glyphs: `${assetsUrl}fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsUrl}sprites/${sprite}`,
    sources: relief ? { ...sources, [RELIEF_SOURCE]: relief.source } : sources,
    layers: [...ground, ...(relief ? [relief.layer] : []), ...lines, ...names],
  };
}

function baseMapLayers({ base, theme, lang }: StyleChoice): BaseMapLayers {
  // Every style has the vector base map, which the services read (services/ServicesLayer.svelte).
  const basemap: SourceSpecification = {
    type: 'vector',
    tiles: [tileUrlTemplate('basemap')],
    maxzoom: BASEMAP_MAX_ZOOM,
    attribution: OSM_ATTRIBUTION,
  };
  if (base === 'streets') {
    return { sources: { [BASEMAP_SOURCE]: basemap }, ...streetMap(namedFlavor(theme), lang) };
  }
  if (base === 'topo') {
    const contours: SourceSpecification = {
      type: 'vector',
      tiles: [tileUrlTemplate('ign-contours')],
      maxzoom: CONTOURS_MAX_ZOOM,
      attribution: CONTOURS_ATTRIBUTION,
    };
    const { ground, names } = streetMap(topoFlavor(theme), lang);
    return {
      sources: { [BASEMAP_SOURCE]: basemap, [CONTOURS_SOURCE]: contours },
      ground,
      lines: contourLayers(),
      names: [...terrainNameLayers(), ...names],
    };
  }
  const ortho: SourceSpecification = {
    type: 'raster',
    tiles: [tileUrlTemplate('ign-ortho')],
    tileSize: 256,
    maxzoom: ORTHO_MAX_ZOOM,
    attribution: ORTHO_ATTRIBUTION,
  };
  return {
    sources: { [ORTHO_SOURCE]: ortho, [BASEMAP_SOURCE]: basemap },
    ground: [{ id: ORTHO_SOURCE, type: 'raster', source: ORTHO_SOURCE }],
    lines: [],
    names: layers(BASEMAP_SOURCE, namedFlavor('dark'), { lang, labelsOnly: true }),
  };
}

/** The Protomaps map in a palette, split where its names begin. */
function streetMap(flavor: Flavor, lang: string): Omit<BaseMapLayers, 'sources'> {
  const all = layers(BASEMAP_SOURCE, flavor, { lang });
  const firstName = all.findIndex((layer) => layer.type === 'symbol');
  const at = firstName === -1 ? all.length : firstName;
  return { ground: all.slice(0, at), lines: [], names: all.slice(at) };
}

/** Shading of the terrain from IGN's terrain model (tile-sources.ts). */
function reliefShading(theme: MapTheme): {
  source: SourceSpecification;
  layer: HillshadeLayerSpecification;
} {
  return {
    source: {
      type: 'raster-dem',
      tiles: [tileUrlTemplate('ign-relief')],
      encoding: 'mapbox',
      tileSize: RELIEF_TILE_SIZE,
      maxzoom: RELIEF_MAX_ZOOM,
      attribution: RELIEF_ATTRIBUTION,
    },
    layer: {
      id: 'relief',
      type: 'hillshade',
      source: RELIEF_SOURCE,
      paint: {
        'hillshade-exaggeration': theme === 'dark' ? 0.35 : 0.45,
        'hillshade-shadow-color': themeColor('map-relief'),
      },
    },
  };
}
