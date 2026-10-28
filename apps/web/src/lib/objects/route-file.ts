// Reading a route from a file made by another app or device: GPX, KML or GeoJSON. Only the way is
// kept: the longest line in the file, and its name. The files are read as text, without an XML
// parser, so the same code runs in the browser and in the tests.

import { pathMeters } from '@tesel/core';
import type { LatLon, Result } from '@tesel/protocol';

export interface FileLine {
  /** The line's own name in the file, or empty. */
  readonly name: string;
  readonly points: readonly LatLon[];
}

export type RouteFileError =
  /** Not GPX, KML or GeoJSON. */
  | 'unsupported'
  /** No line of two points or more. */
  | 'no-line';

export function readRouteFile(text: string): Result<FileLine, RouteFileError> {
  const lines = linesIn(text.trim());
  if (lines === null) return { ok: false, error: 'unsupported' };
  const usable = lines.filter((line) => line.points.length >= 2);
  if (usable.length === 0) return { ok: false, error: 'no-line' };
  const longest = usable.reduce((best, line) =>
    pathMeters(line.points) > pathMeters(best.points) ? line : best,
  );
  return { ok: true, value: longest };
}

/** The lines in a file, or null if it is of none of the formats. */
function linesIn(text: string): FileLine[] | null {
  if (text.startsWith('{')) return geoJsonLines(text);
  if (/<(?:[\w.-]+:)?gpx\b/.test(text)) return gpxLines(text);
  if (/<(?:[\w.-]+:)?kml\b/.test(text)) return kmlLines(text);
  return null;
}

// --- GPX: tracks, their segments joined, and routes ----------------------------------------

function gpxLines(xml: string): FileLine[] {
  const line = (container: string, child: string) =>
    [...elements(xml, container)].map(({ body }) => ({
      name: ownName(body, child),
      points: [...elements(body, child)].flatMap(({ attributes }) =>
        pointOf(Number(attribute(attributes, 'lat')), Number(attribute(attributes, 'lon'))),
      ),
    }));
  return [...line('trk', 'trkpt'), ...line('rte', 'rtept')];
}

// --- KML: the line strings and tracks of each placemark --------------------------------------

function kmlLines(xml: string): FileLine[] {
  return [...elements(xml, 'Placemark')].flatMap(({ body }) => {
    const name = ownName(body, 'LineString');
    const strings = [...elements(body, 'LineString')].map((string) => ({
      name,
      points: [...elements(string.body, 'coordinates')].flatMap((list) =>
        list.body
          .trim()
          .split(/\s+/)
          .flatMap((tuple) => {
            const [lon, lat] = tuple.split(',').map(Number);
            return pointOf(lat, lon);
          }),
      ),
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
}

// --- GeoJSON: line strings and each part of multi-line strings, wherever they are ------------

function geoJsonLines(text: string): FileLine[] | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const lines: FileLine[] = [];
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
    }
  };
  visit(json, '');
  return lines;
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
