// MapLibre style for the Protomaps OpenStreetMap basemap, served through our tile protocol.

import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';

import { TILE_URL_TEMPLATE } from './tile-source.ts';

export type MapTheme = 'light' | 'dark';

/** Highest zoom we download and request; MapLibre over-zooms beyond it. */
export const BASEMAP_MAX_ZOOM = 14;

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · ' +
  '<a href="https://protomaps.com" target="_blank">Protomaps</a>';

export function buildStyle(theme: MapTheme, lang: string, assetsUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: `${assetsUrl}fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsUrl}sprites/${theme}`,
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [TILE_URL_TEMPLATE],
        maxzoom: BASEMAP_MAX_ZOOM,
        attribution: ATTRIBUTION,
      },
    },
    layers: layers('protomaps', namedFlavor(theme), { lang }),
  };
}
