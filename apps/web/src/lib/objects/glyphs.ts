// The pictograms of map symbols, drawn for Tesel on a 24 × 24 grid: strokes two units wide with
// round ends, plus a few filled parts. The same paths draw the map's markers (on a canvas, with
// Path2D) and the symbols in forms (as SVG), so both always look alike.

export interface Glyph {
  readonly strokes: readonly string[];
  readonly fills: readonly string[];
}

const glyph = (strokes: readonly string[], fills: readonly string[] = []): Glyph => ({
  strokes,
  fills,
});

export const GLYPHS = {
  point: glyph([], ['M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8z']),
  injured: glyph([
    'M9 4.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z',
    'M3.8 19.5v-1.2a5.2 5.2 0 0 1 10.4 0v1.2',
    'M18.5 7.5v6M15.5 10.5h6',
  ]),
  search: glyph(['M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13z', 'M15.3 15.3l5 5']),
  flame: glyph([
    'M12 3.2c.8 3.3 5.2 5.4 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-2.6 1.4-4.2 2.6-5.3.2 1.7 1 2.8 2.1 3.2.5-2.8-.5-5.4.5-8.1z',
  ]),
  waves: glyph([
    'M3 8c1.5 0 1.5-1.4 3-1.4S7.5 8 9 8s1.5-1.4 3-1.4S13.5 8 15 8s1.5-1.4 3-1.4S19.5 8 21 8',
    'M3 13c1.5 0 1.5-1.4 3-1.4S7.5 13 9 13s1.5-1.4 3-1.4S13.5 13 15 13s1.5-1.4 3-1.4S19.5 13 21 13',
    'M3 18c1.5 0 1.5-1.4 3-1.4S7.5 18 9 18s1.5-1.4 3-1.4S13.5 18 15 18s1.5-1.4 3-1.4S19.5 18 21 18',
  ]),
  warning: glyph(['M12 4.2L20.8 19.4H3.2Z', 'M12 10v4.2', 'M12 16.9v.1']),
  barrier: glyph([
    'M3.5 8.5h17v5h-17z',
    'M8 8.5l-3 5M13 8.5l-3 5M18 8.5l-3 5',
    'M6 13.5v6M18 13.5v6',
  ]),
  house: glyph(['M4 11.2l8-6.7 8 6.7', 'M6 9.6V19.5h12V9.6', 'M10 19.5v-5h4v5']),
  flag: glyph(['M6.5 21V3.8', 'M6.5 4.8h11l-2.6 4 2.6 4h-11']),
  cross: glyph([], ['M10 4.5h4v5.5h5.5v4H14v5.5h-4V14H4.5v-4H10z']),
  drop: glyph(['M12 3.5c3 4.2 6.2 7.1 6.2 10.6a6.2 6.2 0 0 1-12.4 0c0-3.5 3.2-6.4 6.2-10.6z']),
  helipad: glyph([
    'M12 3.6a8.4 8.4 0 1 1 0 16.8a8.4 8.4 0 1 1 0-16.8z',
    'M9 8.2v7.6M15 8.2v7.6M9 12h6',
  ]),
  mast: glyph(
    ['M12 10.5V20.5M8 20.5h8', 'M8.8 7.2a4.6 4.6 0 0 1 6.4 0', 'M6.2 4.6a8.3 8.3 0 0 1 11.6 0'],
    ['M12 8.8a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z'],
  ),
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof GLYPHS;

/** Width of a glyph's strokes, in grid units. */
export const GLYPH_STROKE = 2;
export const GLYPH_GRID = 24;

/**
 * The tile a symbol sits on: a pointy-top hexagon like the tiles of the logo, centred on (cx, cy)
 * with corners `radius` away. Its width is √3 × radius and its height 2 × radius.
 */
export function tilePath(cx: number, cy: number, radius: number): string {
  const corners = Array.from({ length: 6 }, (_, k) => {
    const angle = (Math.PI / 180) * (60 * k - 30);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${corners.join(' L')} Z`;
}
