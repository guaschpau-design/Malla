// What the map is given where a tile cannot be had (no network, nothing there): offline, it shows
// what was downloaded and leaves the rest blank, instead of failing tile by tile.

function bytes(base64: string): ArrayBuffer {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
}

/** Vector tiles: no data at all. */
export const EMPTY_VECTOR_TILE = new ArrayBuffer(0);

/** Raster maps: a 1 × 1 transparent PNG. */
export const EMPTY_RASTER_TILE = bytes(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);

/**
 * Elevation: a 256 × 256 PNG of sea level in the Terrarium encoding (every pixel 128, 0, 0), so
 * the relief is flat where it is unknown. The map needs every elevation tile to be the same size.
 */
export const FLAT_TERRAIN_TILE = bytes(
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAB+0lEQVR42u3TQQ0AAAjEMED5SeeNBloJS9Yp+GskwA' +
    'BgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAM' +
    'AAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMA' +
    'AYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAABgADAAGAAOAAcAA' +
    'YAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADA' +
    'AGAAOAAcAAYAAwABgADAAGwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAA' +
    'GAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAADgAHAAGAAMAAYAAwABgADgAHAAG' +
    'AAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwA' +
    'BoBrAcQ8AoDeAlclAAAAAElFTkSuQmCC',
);
