// Geometry helpers for the map. Distances come from @tesel/core.

import { EARTH_RADIUS_M } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Map as MapLibreMap } from 'maplibre-gl';

/** A circle as a closed ring of [lon, lat] positions, for drawing. */
export function circleRing(center: LatLon, radius: number, steps = 48): [number, number][] {
  const rad = Math.PI / 180;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radius * Math.cos(angle)) / EARTH_RADIUS_M / rad;
    const dLon = (radius * Math.sin(angle)) / (EARTH_RADIUS_M * Math.cos(center.lat * rad)) / rad;
    ring.push([center.lon + dLon, center.lat + dLat]);
  }
  return ring;
}

/** Web Mercator, as MapLibre draws it, projects a sphere of this radius. */
const WEB_MERCATOR_RADIUS_M = 6_378_137;
/** So the map wraps the equator: 2π times the radius. */
const MAP_CIRCUMFERENCE_M = 2 * Math.PI * WEB_MERCATOR_RADIUS_M;
/** MapLibre's tiles are 512 pixels wide. */
const TILE_PX = 512;

/** Metres on the ground for one pixel of the map, at a zoom and a latitude. */
export function metresPerPixel(zoom: number, lat: number): number {
  return (MAP_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * 2 ** zoom);
}

/** A point in Web Mercator metres (EPSG:3857), as web map services take them: [x, y]. */
export function toWebMercator({ lat, lon }: LatLon): [number, number] {
  const rad = (lat * Math.PI) / 180;
  return [
    (WEB_MERCATOR_RADIUS_M * lon * Math.PI) / 180,
    WEB_MERCATOR_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + rad / 2)),
  ];
}

/** The point at the middle of the map's view. */
export function mapCentre(map: MapLibreMap): LatLon {
  const centre = map.getCenter();
  return { lat: centre.lat, lon: centre.lng };
}

export function toPosition(point: LatLon): [number, number] {
  return [point.lon, point.lat];
}

/**
 * Whether a point is inside a ring of [lon, lat] positions, by ray casting: a ray from the point
 * crosses the ring an odd number of times. Fine at the scale of a town or a region.
 */
export function insideRing(
  ring: readonly (readonly [number, number])[],
  { lat, lon }: LatLon,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as readonly [number, number];
    const [xj, yj] = ring[j] as readonly [number, number];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
