// Marker icons for the map: each symbol's pictogram on a hexagon of its family's colour
// (map/style/glyph-images.ts).

import type { Map as MapLibreMap } from 'maplibre-gl';

import { addGlyphImage } from '../map/style/glyph-images.ts';
import { GLYPHS } from '../ui/glyphs.ts';
import { toneColor } from '../ui/theme.ts';
import { SYMBOLS, symbolImageName } from './catalog.ts';

/** Adds any missing symbol image to the map's current style. */
export function addSymbolImages(map: MapLibreMap): void {
  for (const symbol of SYMBOLS) {
    addGlyphImage(map, symbolImageName(symbol.code), {
      glyph: GLYPHS[symbol.glyph],
      colour: toneColor(symbol.tone),
      shape: 'hexagon',
    });
  }
}
