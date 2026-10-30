// Reading a route or an area from a file made by another app or device: GPX, KML or GeoJSON. Only
// the shape is kept, and its name: for a route, the longest line in the file; for an area, the
// largest polygon, or line that closes on itself, as a track walked round a place does. The files
// are read as text, without an XML parser, so the same code runs in the browser and in the tests.

import { areaSquareMeters, distanceMeters, pathMeters } from '@tesel/core';
import type { LatLon, Result } from '@tesel/protocol';

export interface FileShape {
  /** The shape's own name in the file, or empty. */
  readonly name: string;
  readonly points: readonly LatLon[];
}

export type ShapeFileError =
  /** Not GPX, KML or GeoJSON. */
  | 'unsupported'
  /** For a route: no line of two points or more. */
  | 'no-line'
  /** For an area: no polygon, nor closed line, of three corners or more. */
  | 'no-area';

/** A line whose ends are this close goes round a place: it is an area. */
const CLOSES_M = 25;

export function readShapeFile(
  text: string,
  kind: 'route' | 'area',
): Result<FileShape, ShapeFileError> {
  const shapes = shapesIn(text.trim());
  if (shapes === null) return { ok: false, error: 'unsupported' };
  return kind === 'route' ? longestLine(shapes.lines) : largestArea(shapes);
}

/** The lines and the polygons' outer rings in a file. */
interface Shapes {
  readonly lines: readonly FileShape[];
  readonly rings: readonly FileShape[];
}

function longestLine(lines: readonly FileShape[]): Result<FileShape, ShapeFileError> {
  const usable = lines.filter((line) => line.points.length >= 2);
  if (usable.length === 0) return { ok: false, error: 'no-line' };
  const longest = usable.reduce((best, line) =>
    pathMeters(line.points) > pathMeters(best.points) ? line : best,
  );
  return { ok: true, value: longest };
}

function largestArea({ lines, rings }: Shapes): Result<FileShape, ShapeFileError> {
  const closed = lines.filter(({ points }) => {
    const [first] = points;
    const last = points.at(-1);
    return (
      points.length >= 4 &&
      first !== undefined &&
      last !== undefined &&
      distanceMeters(first, last) <= CLOSES_M
    );
  });
  const areas = [...rings, ...closed]
    .map((shape) => ({ ...shape, points: unclosed(shape.points) }))
    .filter((shape) => shape.points.length >= 3);
  if (areas.length === 0) return { ok: false, error: 'no-area' };
  const largest = areas.reduce((best, area) =>
    areaSquareMeters(area.points) > areaSquareMeters(best.points) ? area : best,
  );
  return { ok: true, value: largest };
}

/** A ring's corners, without the last when it only closes the ring on the first. */
function unclosed(points: readonly LatLon[]): readonly LatLon[] {
  const [first] = points;
  const last = points.at(-1);
  const repeats = first !== undefined && last !== undefined && distanceMeters(first, last) < 1;
  return repeats && points.length > 1 ? points.slice(0, -1) : points;
}

/** The shapes in a file, or null if it is of none of the formats. */
function shapesIn(text: string): Shapes | null {
  if (text.startsWith('{')) return geoJsonShapes(text);
  if (/<(?:[\w.-]+:)?gpx\b/.test(text)) return { lines: gpxLines(text), rings: [] };
  if (/<(?:[\w.-]+:)?kml\b/.test(text)) return kmlShapes(text);
  return null;
}

// --- GPX: tracks, their segments joined, and routes ----------------------------------------

function gpxLines(xml: string): FileShape[] {
  const line = (container: string, child: string) =>
    [...elements(xml, container)].map(({ body }) => ({
      name: ownName(body, child),
      points: [...elements(body, child)].flatMap(({ attributes }) =>
        pointOf(Number(attribute(attributes, 'lat')), Number(attribute(attributes, 'lon'))),
      ),
    }));
  return [...line('trk', 'trkpt'), ...line('rte', 'rtept')];
}

// --- KML: the line strings, tracks and polygons of each placemark ---------------------------

function kmlShapes(xml: string): Shapes {
  const placemarks = [...elements(xml, 'Placemark')].map(({ body }) => body);
  const lines = placemarks.flatMap((body) => {
    const name = ownName(body, 'LineString');
    const strings = [...elements(body, 'LineString')].map((string) => ({
      name,
      points: kmlCoordinates(string.body),
    }));
    const tracks = [...elements(body, 'Track')].map((track) => ({
      name,
      points: [...elements(track.body, 'coord')].flatMap((coord) => {
        const [lon, lat] = coord.body.trim().split(/\s+/).map(Number);
        return pointOf(lat, lon);
      }),
    }));
    return [...strings, ...tracks];
  });
  const rings = placemarks.flatMap((body) => {
    const name = ownName(body, 'Polygon');
    return [...elements(body, 'Polygon')].flatMap((polygon) =>
      [...elements(polygon.body, 'outerBoundaryIs')].map((outer) => ({
        name,
        points: kmlCoordinates(outer.body),
      })),
    );
  });
  return { lines, rings };
}

/** The points of the `<coordinates>` an element holds: "lon,lat[,alt]" tuples. */
function kmlCoordinates(body: string): LatLon[] {
  return [...elements(body, 'coordinates')].flatMap((list) =>
    list.body
      .trim()
      .split(/\s+/)
      .flatMap((tuple) => {
        const [lon, lat] = tuple.split(',').map(Number);
        return pointOf(lat, lon);
      }),
  );
}

// --- GeoJSON: line strings, polygons and the parts of multi ones, wherever they are ----------

function geoJsonShapes(text: string): Shapes | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const lines: FileShape[] = [];
  const rings: FileShape[] = [];
  /** A polygon's outer ring, its first. */
  const outer = (polygon: unknown, name: string) => {
    const [ring] = arrayOf(polygon);
    rings.push({ name, points: positions(ring) });
  };
  const visit = (value: unknown, name: string): void => {
    if (!isRecord(value)) return;
    switch (value['type']) {
      case 'FeatureCollection':
        for (const feature of arrayOf(value['features'])) visit(feature, '');
        return;
      case 'Feature': {
        const properties = isRecord(value['properties']) ? value['properties'] : {};
        const own = properties['name'] ?? properties['title'];
        visit(value['geometry'], typeof own === 'string' ? own.trim() : '');
        return;
      }
      case 'GeometryCollection':
        for (const geometry of arrayOf(value['geometries'])) visit(geometry, name);
        return;
      case 'LineString':
        lines.push({ name, points: positions(value['coordinates']) });
        return;
      case 'MultiLineString':
        for (const part of arrayOf(value['coordinates'])) {
          lines.push({ name, points: positions(part) });
        }
        return;
      case 'Polygon':
        outer(value['coordinates'], name);
        return;
      case 'MultiPolygon':
        for (const part of arrayOf(value['coordinates'])) outer(part, name);
        return;
    }
  };
  visit(json, '');
  return { lines, rings };
}

function positions(value: unknown): LatLon[] {
  return arrayOf(value).flatMap((position) => {
    const [lon, lat] = arrayOf(position);
    return pointOf(lat, lon);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

// --- XML, as far as these formats need it ----------------------------------------------------

/** Each element of a name, with any namespace prefix: its attributes and what it holds. */
function* elements(xml: string, name: string): Generator<{ attributes: string; body: string }> {
  const prefix = '(?:[\\w.-]+:)?';
  const close = new RegExp(`</${prefix}${name}\\s*>`, 'g');
  for (const open of xml.matchAll(new RegExp(`<${prefix}${name}(\\s[^>]*?)?(/?)>`, 'g'))) {
    const attributes = open[1] ?? '';
    if (open[2] === '/') {
      yield { attributes, body: '' };
      continue;
    }
    const start = open.index + open[0].length;
    close.lastIndex = start;
    const end = close.exec(xml);
    yield { attributes, body: xml.slice(start, end?.index ?? xml.length) };
  }
}

/** The name of what an element holds: the first <name> before its first `child`. */
function ownName(body: string, child: string): string {
  const head = body.split(new RegExp(`<(?:[\\w.-]+:)?${child}\\b`))[0] ?? '';
  const [name] = elements(head, 'name');
  return name ? textOf(name.body) : '';
}

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`).exec(attributes)?.[2];
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** The text an element holds, its markup undone. */
function textOf(body: string): string {
  return body
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** A point if the numbers are a valid latitude and longitude, else none. */
function pointOf(lat: unknown, lon: unknown): LatLon[] {
  if (typeof lat !== 'number' || typeof lon !== 'number') return [];
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return [];
  return [{ lat, lon }];
}
