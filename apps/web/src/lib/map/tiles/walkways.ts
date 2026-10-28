// The streets and paths of the base map around a point, as lines: what the practice's simulated
// members keep to, so that none of them walks through a building or across a river
// (@tesel/scenario's WalkNetwork). Read from the base map's last level, where every footpath is,
// through the same tiles the map shows, downloaded ones first: offline too.

import { VectorTile } from '@mapbox/vector-tile';
import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { PbfReader } from 'pbf';

import { boundsAround, tilesInBounds, type TileCoord } from './math.ts';
import { BASEMAP_MAX_ZOOM } from './sources.ts';

/** The base map's tile at a place, or undefined where it cannot be had (offline, not downloaded). */
export type BasemapTile = (tile: TileCoord) => Promise<ArrayBuffer | undefined>;

/**
 * Kinds of the base map's roads (the Protomaps schema) that a person walks: streets, roads and
 * paths, not motorways or railways.
 */
const WALKABLE = new Set(['major_road', 'minor_road', 'path', 'other']);

/** The streets and paths within `radius` metres of `centre`, in the tiles that can be had. */
export async function walkwaysAround(
  centre: LatLon,
  radius: number,
  tileOf: BasemapTile,
): Promise<LatLon[][]> {
  const bounds = boundsAround([
    offsetMeters(centre, -radius, -radius),
    offsetMeters(centre, radius, radius),
  ]);
  const tiles = [...tilesInBounds(bounds, BASEMAP_MAX_ZOOM, BASEMAP_MAX_ZOOM)];
  const lines = await Promise.all(
    tiles.map(async (tile) => {
      const bytes = await tileOf(tile);
      return bytes === undefined ? [] : walkwaysIn(bytes, tile);
    }),
  );
  return lines.flat();
}

/** The streets and paths of one tile of the base map. */
function walkwaysIn(bytes: ArrayBuffer, { z, x, y }: TileCoord): LatLon[][] {
  const roads = new VectorTile(new PbfReader(new Uint8Array(bytes))).layers['roads'];
  if (roads === undefined) return [];
  const lines: LatLon[][] = [];
  for (let index = 0; index < roads.length; index += 1) {
    const road = roads.feature(index);
    if (!WALKABLE.has(String(road.properties['kind']))) continue;
    const { geometry } = road.toGeoJSON(x, y, z);
    const parts =
      geometry.type === 'LineString'
        ? [geometry.coordinates]
        : geometry.type === 'MultiLineString'
          ? geometry.coordinates
          : [];
    for (const part of parts) lines.push(part.map(([lon = 0, lat = 0]) => ({ lat, lon })));
  }
  return lines;
}
