// Elevations of points, read from Terrarium elevation tiles (map/tile-sources.ts): the tiles are
// decoded once and kept while they are in use, since guidance asks for the same ones again and
// again as the device moves.

import type { LatLon } from '@tesel/protocol';

import type { TileCoord } from '../map/tile-math.ts';
import { TERRAIN_MAX_ZOOM } from '../map/tile-sources.ts';

/** The pixels of a decoded tile: RGBA, row by row. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** Tile bytes from wherever they are (downloaded, or the network); undefined if not to be had. */
export type ElevationTiles = (tile: TileCoord) => Promise<ArrayBuffer | undefined>;

/** Decoded tiles kept at once: a few kilometres around the device. */
const CACHE_TILES = 24;

/** Metres above sea level of a Terrarium pixel. */
export function terrariumMetres(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32_768;
}

/** The tile of a point at a zoom, and where in it the point is, from 0 to 1. */
export function tileAt(at: LatLon, z: number): { tile: TileCoord; u: number; v: number } {
  const n = 2 ** z;
  const x = ((at.lon + 180) / 360) * n;
  const rad = (at.lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tile = { z, x: Math.floor(x), y: Math.floor(y) };
  return { tile, u: x - tile.x, v: y - tile.y };
}

export class ElevationReader {
  readonly #tiles: ElevationTiles;
  readonly #decode: (bytes: ArrayBuffer) => Promise<Pixels>;
  /** Decoded tiles, least recently used first; null for tiles that could not be had. */
  readonly #cache = new Map<string, Promise<Pixels | null>>();

  constructor(
    tiles: ElevationTiles,
    decode: (bytes: ArrayBuffer) => Promise<Pixels> = decodeImage,
  ) {
    this.#tiles = tiles;
    this.#decode = decode;
  }

  /** Elevations in metres, in the order of the points; null where unknown. */
  async elevations(points: readonly LatLon[]): Promise<(number | null)[]> {
    return Promise.all(points.map((point) => this.#elevation(point)));
  }

  async #elevation(at: LatLon): Promise<number | null> {
    const { tile, u, v } = tileAt(at, TERRAIN_MAX_ZOOM);
    const pixels = await this.#pixels(tile);
    if (pixels === null) return null;
    const column = Math.min(pixels.width - 1, Math.floor(u * pixels.width));
    const row = Math.min(pixels.height - 1, Math.floor(v * pixels.height));
    const offset = (row * pixels.width + column) * 4;
    const { data } = pixels;
    return terrariumMetres(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
  }

  #pixels(tile: TileCoord): Promise<Pixels | null> {
    const key = `${String(tile.z)}/${String(tile.x)}/${String(tile.y)}`;
    let pixels = this.#cache.get(key);
    if (pixels === undefined) {
      pixels = this.#load(tile);
      if (this.#cache.size >= CACHE_TILES) {
        const [oldest] = this.#cache.keys();
        if (oldest !== undefined) this.#cache.delete(oldest);
      }
    } else {
      this.#cache.delete(key);
    }
    this.#cache.set(key, pixels);
    return pixels;
  }

  async #load(tile: TileCoord): Promise<Pixels | null> {
    try {
      const bytes = await this.#tiles(tile);
      return bytes === undefined ? null : await this.#decode(bytes);
    } catch {
      return null;
    }
  }
}

/** The pixels of an image file, whatever its format (the tiles are WebP, the fallback PNG). */
async function decodeImage(bytes: ArrayBuffer): Promise<Pixels> {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('no 2D canvas');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
