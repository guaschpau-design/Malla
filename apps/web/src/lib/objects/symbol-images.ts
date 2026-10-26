// Marker icons for the map, drawn at runtime: the symbol's pictogram in white on a hexagonal tile
// of its family's colour, with a white edge and a soft shadow so it holds on any base map.

import type { Map as MapLibreMap } from 'maplibre-gl';

import { toneColor } from '../ui/theme.ts';
import { SYMBOLS, symbolImageName } from './catalog.ts';
import {
  GLYPH_GRID,
  GLYPH_STROKE,
  GLYPHS,
  TILE_GLYPH_SIZE,
  TILE_RADIUS,
  tilePath,
} from '../ui/glyphs.ts';

/** Drawn at twice the size, for sharp icons on high-density screens. */
const PIXEL_RATIO = 2;
/** Room around the tile for its edge and shadow. */
const MARGIN = 4;
const EDGE = 2;
/** The pictogram and the tile's edge are white on every family's colour. */
const WHITE = '#ffffff';

const WIDTH = Math.ceil(Math.sqrt(3) * TILE_RADIUS) + 2 * MARGIN;
const HEIGHT = 2 * TILE_RADIUS + 2 * MARGIN;

/** Adds any missing symbol image to the map's current style. */
export function addSymbolImages(map: MapLibreMap): void {
  for (const symbol of SYMBOLS) {
    const name = symbolImageName(symbol.code);
    if (map.hasImage(name)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH * PIXEL_RATIO;
    canvas.height = HEIGHT * PIXEL_RATIO;
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.scale(PIXEL_RATIO, PIXEL_RATIO);

    const tile = new Path2D(tilePath(WIDTH / 2, HEIGHT / 2, TILE_RADIUS));
    context.save();
    context.shadowColor = 'rgb(0 0 0 / 30%)';
    context.shadowBlur = 3;
    context.shadowOffsetY = 1;
    context.fillStyle = toneColor(symbol.tone);
    context.fill(tile);
    context.restore();
    context.lineJoin = 'round';
    context.lineWidth = EDGE;
    context.strokeStyle = WHITE;
    context.stroke(tile);

    const glyph = GLYPHS[symbol.glyph];
    const scale = TILE_GLYPH_SIZE / GLYPH_GRID;
    context.translate((WIDTH - TILE_GLYPH_SIZE) / 2, (HEIGHT - TILE_GLYPH_SIZE) / 2);
    context.scale(scale, scale);
    context.strokeStyle = WHITE;
    context.fillStyle = WHITE;
    context.lineWidth = GLYPH_STROKE;
    context.lineCap = 'round';
    for (const path of glyph.strokes) context.stroke(new Path2D(path));
    for (const path of glyph.fills) context.fill(new Path2D(path));

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    map.addImage(name, image, { pixelRatio: PIXEL_RATIO });
  }
}
