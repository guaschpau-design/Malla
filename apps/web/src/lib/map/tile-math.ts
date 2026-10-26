// Web Mercator tile arithmetic (XYZ scheme, as used by MapLibre and PMTiles), and the bounds it
// works on.

import type { LatLon } from '@tesel/protocol';

export interface Bounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface TileCoord {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/** Web Mercator cannot represent the poles; latitudes are clamped to this value. */
const MAX_MERCATOR_LAT = 85.0511287798;

export function lonToTileX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
}

export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return Math.min(n - 1, Math.max(0, y));
}

/** Inclusive tile ranges covering `bounds` at zoom `z`. Bounds must not cross the antimeridian. */
export function tileRange(
  bounds: Bounds,
  z: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: lonToTileX(bounds.west, z),
    maxX: lonToTileX(bounds.east, z),
    minY: latToTileY(bounds.north, z),
    maxY: latToTileY(bounds.south, z),
  };
}

export function countTiles(bounds: Bounds, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    total += (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
  }
  return total;
}

/** Every tile covering `bounds` from `minZoom` to `maxZoom`, lowest zoom first. */
export function* tilesInBounds(
  bounds: Bounds,
  minZoom: number,
  maxZoom: number,
): Generator<TileCoord> {
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    for (let x = r.minX; x <= r.maxX; x++) {
      for (let y = r.minY; y <= r.maxY; y++) yield { z, x, y };
    }
  }
}

export function tileKey(tile: TileCoord): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/** The smallest bounds around some points; they must not cross the antimeridian. */
export function boundsAround(points: readonly LatLon[]): Bounds {
  return {
    west: Math.min(...points.map((point) => point.lon)),
    south: Math.min(...points.map((point) => point.lat)),
    east: Math.max(...points.map((point) => point.lon)),
    north: Math.max(...points.map((point) => point.lat)),
  };
}

/** Whether `outer` holds all of `inner`. */
export function containsBounds(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}
