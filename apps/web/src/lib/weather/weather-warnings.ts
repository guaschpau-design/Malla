// The official weather warnings a server publishes (docs/protocol.md §8.4), as the app uses them:
// the regions still under some warning, which of them hold a point, and how each level looks.

import { highestLevel } from '@tesel/protocol';
import type {
  LatLon,
  RegionGeometry,
  WarningLevel,
  WarningRegion,
  WarningText,
  WeatherWarning,
  WeatherWarnings,
} from '@tesel/protocol';
import type { FeatureCollection } from 'geojson';

import type { Locale, MessageKey } from '../i18n/index.ts';
import type { Tone } from '../ui/theme.ts';

/** How each level is named and coloured: yellow, orange, red. */
export const WARNING_LOOKS: Readonly<Record<WarningLevel, { label: MessageKey; tone: Tone }>> = {
  2: { label: 'warningYellow', tone: 'amber' },
  3: { label: 'warningOrange', tone: 'orange' },
  4: { label: 'warningRed', tone: 'red' },
};

/** A region still under warning, with its bounds to rule points out quickly. */
export interface ActiveRegion {
  readonly region: WarningRegion;
  /** [west, south, east, north]. */
  readonly bounds: readonly [number, number, number, number];
}

/**
 * The regions of a document with some warning that has not expired at `now` (seconds), each with
 * only those warnings and the level they make. Worked out once per document and minute, so that
 * looking up a point is cheap.
 */
export function activeRegions(document: WeatherWarnings, now: number): ActiveRegion[] {
  return document.features.flatMap((region) => {
    const warnings = region.properties.warnings.filter((warning) => warning.expires > now);
    if (warnings.length === 0) return [];
    const properties = { ...region.properties, warnings, level: highestLevel(warnings) };
    return [{ region: { ...region, properties }, bounds: boundsOf(region.geometry) }];
  });
}

/** The warnings in force or announced at a point, highest level first. */
export function warningsAt(regions: readonly ActiveRegion[], at: LatLon): WeatherWarning[] {
  return regions
    .filter(({ region, bounds }) => withinBounds(bounds, at) && contains(region.geometry, at))
    .flatMap(({ region }) => region.properties.warnings)
    .sort((a, b) => b.level - a.level || a.onset - b.onset);
}

/** The regions to draw, each with its level as a `tone` the map colours (ui/theme.ts). */
export function regionFeatures(regions: readonly ActiveRegion[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: regions.map(({ region }) => ({
      type: 'Feature',
      geometry: region.geometry,
      properties: { tone: WARNING_LOOKS[region.properties.level].tone },
    })),
  };
}

/** A warning's text in the app's language, or in the other one if the issuer gave only that. */
export function warningText(warning: WeatherWarning, locale: Locale): WarningText | null {
  return warning.text[locale] ?? warning.text.es ?? warning.text.en ?? null;
}

function boundsOf(geometry: RegionGeometry): [number, number, number, number] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons) {
    // The outer ring holds the rest.
    for (const [lon, lat] of polygon[0] ?? []) {
      bounds[0] = Math.min(bounds[0], lon);
      bounds[1] = Math.min(bounds[1], lat);
      bounds[2] = Math.max(bounds[2], lon);
      bounds[3] = Math.max(bounds[3], lat);
    }
  }
  return bounds;
}

function withinBounds([west, south, east, north]: ActiveRegion['bounds'], at: LatLon): boolean {
  return at.lon >= west && at.lon <= east && at.lat >= south && at.lat <= north;
}

/** Whether a point is inside a polygon or multipolygon, holes left out. */
export function contains(geometry: RegionGeometry, at: LatLon): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) =>
      outer !== undefined && inRing(outer, at) && !holes.some((hole) => inRing(hole, at)),
  );
}

/** Ray casting: a point is inside a ring if a ray from it crosses the ring an odd number of times. */
function inRing(ring: readonly [number, number][], { lat, lon }: LatLon): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
