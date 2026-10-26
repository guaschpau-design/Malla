// Map icons drawn at runtime: a pictogram in white on a coloured tile, with a white edge and a soft
// shadow so it holds on any base map. The group's markers sit on hexagons, like the tiles of the
// logo; places of the base map (services) on circles, so the two are never confused.

import type { Map as MapLibreMap } from 'maplibre-gl';

import {
  GLYPH_GRID,
  GLYPH_STROKE,
  TILE_GLYPH_SIZE,
  TILE_RADIUS,
  tilePath,
  type Glyph,
} from '../ui/glyphs.ts';

export type IconShape = 'hexagon' | 'circle';

/** Drawn at twice the size, for sharp icons on high-density screens. */
const PIXEL_RATIO = 2;
/** Room around the tile for its edge and shadow. */
const MARGIN = 4;
const EDGE = 2;
/** The pictogram and the tile's edge are white on every colour. */
const WHITE = '#ffffff';

/** Circles are smaller than hexagons: a service is a reference, a marker is news. */
const CIRCLE_RADIUS = 12;
const CIRCLE_GLYPH_SIZE = 14;

interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly outline: string;
  readonly glyphSize: number;
}

function geometryOf(shape: IconShape): Geometry {
  if (shape === 'hexagon') {
    const width = Math.ceil(Math.sqrt(3) * TILE_RADIUS) + 2 * MARGIN;
    const height = 2 * TILE_RADIUS + 2 * MARGIN;
    return {
      width,
      height,
      outline: tilePath(width / 2, height / 2, TILE_RADIUS),
      glyphSize: TILE_GLYPH_SIZE,
    };
  }
  const size = 2 * CIRCLE_RADIUS + 2 * MARGIN;
  const centre = size / 2;
  return {
    width: size,
    height: size,
    outline: `M${String(centre - CIRCLE_RADIUS)} ${String(centre)}a${String(CIRCLE_RADIUS)} ${String(CIRCLE_RADIUS)} 0 1 0 ${String(2 * CIRCLE_RADIUS)} 0a${String(CIRCLE_RADIUS)} ${String(CIRCLE_RADIUS)} 0 1 0 ${String(-2 * CIRCLE_RADIUS)} 0z`,
    glyphSize: CIRCLE_GLYPH_SIZE,
  };
}

/** Adds an icon to the map's current style under `name`, unless the style already has it. */
export function addGlyphImage(
  map: MapLibreMap,
  name: string,
  icon: { readonly glyph: Glyph; readonly colour: string; readonly shape: IconShape },
): void {
  if (map.hasImage(name)) return;
  const { width, height, outline, glyphSize } = geometryOf(icon.shape);
  const canvas = document.createElement('canvas');
  canvas.width = width * PIXEL_RATIO;
  canvas.height = height * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);

  const tile = new Path2D(outline);
  context.save();
  context.shadowColor = 'rgb(0 0 0 / 30%)';
  context.shadowBlur = 3;
  context.shadowOffsetY = 1;
  context.fillStyle = icon.colour;
  context.fill(tile);
  context.restore();
  context.lineJoin = 'round';
  context.lineWidth = EDGE;
  context.strokeStyle = WHITE;
  context.stroke(tile);

  const scale = glyphSize / GLYPH_GRID;
  context.translate((width - glyphSize) / 2, (height - glyphSize) / 2);
  context.scale(scale, scale);
  context.strokeStyle = WHITE;
  context.fillStyle = WHITE;
  context.lineWidth = GLYPH_STROKE;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const path of icon.glyph.strokes) context.stroke(new Path2D(path));
  for (const path of icon.glyph.fills) context.fill(new Path2D(path));

  map.addImage(name, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: PIXEL_RATIO,
  });
}
