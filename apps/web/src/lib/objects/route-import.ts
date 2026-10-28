// A route read from a file the user picks: refused if the file is too big to be a route, and
// thinned to the points a shape can carry over the radio (draft.ts), with what that cost.

import { simplifyLine } from '@tesel/core';
import { SHAPE_LABEL_MAX_BYTES, SHAPE_MAX_POINTS, type LatLon, type Result } from '@tesel/protocol';

import { fitBytes } from '../text.ts';
import { readRouteFile, type RouteFileError } from './route-file.ts';

/** A route of a whole day's walk, recorded every second, takes a few megabytes of GPX. */
export const MAX_ROUTE_FILE_BYTES = 5 * 1024 * 1024;

export interface ImportedRoute {
  /** The line's name in the file, or else the file's, cut to fit a label. */
  readonly name: string;
  readonly points: readonly LatLon[];
  /** How many points the file's line had. */
  readonly read: number;
  /** The most the route kept strays from the file's line, in metres. */
  readonly deviation: number;
}

export type RouteImportError = RouteFileError | 'too-big' | 'unreadable';

export async function importRoute(file: File): Promise<Result<ImportedRoute, RouteImportError>> {
  if (file.size > MAX_ROUTE_FILE_BYTES) return { ok: false, error: 'too-big' };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  const read = readRouteFile(text);
  if (!read.ok) return read;
  const line = withoutRepeats(read.value.points);
  if (line.length < 2) return { ok: false, error: 'no-line' };
  const { points, deviation } = simplifyLine(line, SHAPE_MAX_POINTS);
  const name = read.value.name || file.name.replace(/\.[^.]*$/, '');
  return {
    ok: true,
    value: {
      name: fitBytes(name.trim(), SHAPE_LABEL_MAX_BYTES),
      points,
      read: line.length,
      deviation,
    },
  };
}

/** The line without a point that repeats the one before it, as recorders do while standing. */
function withoutRepeats(line: readonly LatLon[]): LatLon[] {
  return line.filter(
    (point, index) =>
      index === 0 || point.lat !== line[index - 1]?.lat || point.lon !== line[index - 1]?.lon,
  );
}
