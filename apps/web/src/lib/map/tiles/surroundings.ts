// What surrounds a point, read from the base map: the streets and paths a person walks, with their
// names, the rivers, streams and canals, and the parks and woods. The practice's simulated members
// keep to the streets (@tesel/scenario's WalkNetwork), and its situations take place among the
// rest: water rises from a stream, someone lost is found in a park, a street is called by its name.
// Read from the base map's last level, where every footpath is, through the same tiles the map
// shows, downloaded ones first: offline too.

import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { PbfReader } from 'pbf';

import { boundsAround, tilesInBounds, type TileCoord } from './math.ts';
import { BASEMAP_MAX_ZOOM } from './sources.ts';

/** The base map's tile at a place, or undefined where it cannot be had (offline, not downloaded). */
export type BasemapTile = (tile: TileCoord) => Promise<ArrayBuffer | undefined>;

/** A line of the map, with its name if it has one. */
export interface NamedLine {
  readonly points: readonly LatLon[];
  readonly name: string | null;
}

/** An area of the map, by its outer edge, with its name if it has one. */
export interface NamedArea {
  readonly ring: readonly LatLon[];
  readonly name: string | null;
}

export interface Surroundings {
  /** The streets and paths a person walks. */
  readonly ways: readonly NamedLine[];
  /** Rivers, streams, canals and ditches. */
  readonly waterways: readonly NamedLine[];
  /** Parks, gardens, lawns and woods. */
  readonly greens: readonly NamedArea[];
}

const NOTHING: Surroundings = { ways: [], waterways: [], greens: [] };

/**
 * Kinds of the base map's roads (the Protomaps schema) that a person walks: streets, roads and
 * paths, not motorways or railways.
 */
const WALKABLE = new Set(['major_road', 'minor_road', 'path', 'other']);

/** Kinds of the base map's land use that are green: where a walk may lead, and someone get lost. */
const GREEN = new Set([
  'park',
  'garden',
  'grass',
  'forest',
  'wood',
  'nature_reserve',
  'playground',
  'recreation_ground',
]);

/**
 * What lies within `radius` metres of `centre`, in the tiles that can be had and read: a tile
 * that cannot is left out, and what the others hold kept.
 */
export async function surroundingsAround(
  centre: LatLon,
  radius: number,
  tileOf: BasemapTile,
): Promise<Surroundings> {
  const bounds = boundsAround([
    offsetMeters(centre, -radius, -radius),
    offsetMeters(centre, radius, radius),
  ]);
  const tiles = [...tilesInBounds(bounds, BASEMAP_MAX_ZOOM, BASEMAP_MAX_ZOOM)];
  const read = await Promise.all(
    tiles.map(async (tile) => {
      try {
        const bytes = await tileOf(tile);
        return bytes === undefined ? NOTHING : surroundingsIn(bytes, tile);
      } catch (error) {
        console.warn('A base map tile could not be read:', error);
        return NOTHING;
      }
    }),
  );
  return {
    ways: read.flatMap((part) => part.ways),
    waterways: read.flatMap((part) => part.waterways),
    greens: read.flatMap((part) => part.greens),
  };
}

/** What one tile of the base map holds. */
function surroundingsIn(bytes: ArrayBuffer, tile: TileCoord): Surroundings {
  const { layers } = new VectorTile(new PbfReader(new Uint8Array(bytes)));
  const features = (layer: string, kinds: ReadonlySet<string> | null) => {
    const found = layers[layer];
    if (found === undefined) return [];
    return Array.from({ length: found.length }, (_, index) => found.feature(index)).filter(
      (feature) => kinds === null || kinds.has(String(feature.properties['kind'])),
    );
  };
  return {
    ways: features('roads', WALKABLE).flatMap((feature) => linesOf(feature, tile)),
    waterways: features('water', null).flatMap((feature) => linesOf(feature, tile)),
    greens: features('landuse', GREEN).flatMap((feature) => areasOf(feature, tile)),
  };
}

/** The lines of a feature, each with the feature's name; none if it is not a line. */
function linesOf(feature: VectorTileFeature, { z, x, y }: TileCoord): NamedLine[] {
  const { geometry } = feature.toGeoJSON(x, y, z);
  const parts =
    geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.type === 'MultiLineString'
        ? geometry.coordinates
        : [];
  const name = nameOf(feature);
  return parts.map((part) => ({ points: part.map(toLatLon), name }));
}

/** The areas of a feature, by their outer edges, each with the feature's name. */
function areasOf(feature: VectorTileFeature, { z, x, y }: TileCoord): NamedArea[] {
  const { geometry } = feature.toGeoJSON(x, y, z);
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  const name = nameOf(feature);
  return polygons.flatMap(([outer]) => (outer ? [{ ring: outer.map(toLatLon), name }] : []));
}

function nameOf(feature: VectorTileFeature): string | null {
  const name = feature.properties['name'];
  return typeof name === 'string' && name.length > 0 ? name : null;
}

function toLatLon([lon = 0, lat = 0]: readonly number[]): LatLon {
  return { lat, lon };
}
