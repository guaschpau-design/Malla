// The outlines of MeteoAlarm's warning regions (EMMA_ID codes), which its feeds name but do not
// draw. MeteoAlarm publishes them as a dated GeoJSON file in its documents repository; we keep
// the regions of our countries, with coordinates rounded to about 100 m (docs/protocol.md §8.4).

import type { RegionGeometry } from '@tesel/protocol';

/** MeteoAlarm's documents repository, through GitLab's API. */
const REPOSITORY = 'https://gitlab.com/api/v4/projects/meteoalarm-pm-group%2Fdocuments/repository';
const GEOCODES_FILE = /^MeteoAlarm_Geocodes_\d{4}_\d{2}_\d{2}\.json$/;

/** The listing of the repository's files, where the newest outlines are looked for. */
export const REGIONS_LISTING_URL = `${REPOSITORY}/tree?per_page=100`;

export interface Region {
  readonly name: string;
  readonly geometry: RegionGeometry;
}

/** The URL of the newest outlines file in the repository listing, or null if there is none. */
export function newestRegionsUrl(listing: unknown): string | null {
  if (!Array.isArray(listing)) return null;
  const names = listing
    .map((entry: unknown) => (entry as { path?: unknown } | null)?.path)
    .filter((path): path is string => typeof path === 'string' && GEOCODES_FILE.test(path))
    // The date in the name sorts as text.
    .sort();
  const newest = names.at(-1);
  return newest === undefined
    ? null
    : `${REPOSITORY}/files/${encodeURIComponent(newest)}/raw?ref=master`;
}

/** The regions of `countries` (ISO codes) in an outlines file, by EMMA_ID code. */
export function regionsOf(geojson: unknown, countries: readonly string[]): Map<string, Region> {
  const regions = new Map<string, Region>();
  const features = (geojson as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return regions;
  for (const feature of features) {
    const { properties, geometry } = (feature ?? {}) as {
      properties?: { code?: unknown; country?: unknown; name?: unknown };
      geometry?: { type?: unknown; coordinates?: unknown };
    };
    const { code, country, name } = properties ?? {};
    if (typeof code !== 'string' || typeof name !== 'string') continue;
    if (typeof country !== 'string' || !countries.includes(country)) continue;
    const rounded = roundGeometry(geometry);
    if (rounded !== null) regions.set(code, { name, geometry: rounded });
  }
  return regions;
}

type Ring = [number, number][];

function roundGeometry(geometry: { type?: unknown; coordinates?: unknown } | undefined) {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;
  if (geometry?.type === 'Polygon') {
    return { type: 'Polygon', coordinates: roundPolygon(coordinates) } satisfies RegionGeometry;
  }
  if (geometry?.type === 'MultiPolygon') {
    const polygons = coordinates.map((polygon: unknown) =>
      Array.isArray(polygon) ? roundPolygon(polygon) : [],
    );
    return { type: 'MultiPolygon', coordinates: polygons } satisfies RegionGeometry;
  }
  return null;
}

/** Rounds each position to 3 decimals and drops the repeats rounding leaves. */
function roundPolygon(rings: readonly unknown[]): Ring[] {
  return rings.map((ring) => {
    const rounded: Ring = [];
    for (const position of Array.isArray(ring) ? ring : []) {
      const [lon, lat] = position as [unknown, unknown];
      if (typeof lon !== 'number' || typeof lat !== 'number') continue;
      const point: [number, number] = [round(lon), round(lat)];
      const last = rounded.at(-1);
      if (last?.[0] !== point[0] || last[1] !== point[1]) rounded.push(point);
    }
    return rounded;
  });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
