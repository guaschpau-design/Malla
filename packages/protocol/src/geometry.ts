// Coordinates and delta-encoded point lists (docs/protocol.md §1 and §3.7).

import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import { COORDINATE_SCALE, DELTA_UNIT } from './constants.ts';
import type { LatLon } from './events.ts';

const MAX_LAT_UNITS = 90 * COORDINATE_SCALE;
const MAX_LON_UNITS = 180 * COORDINATE_SCALE;
const I16_MIN = -0x8000;
const I16_MAX = 0x7fff;

interface PointUnits {
  readonly lat: number;
  readonly lon: number;
}

function toUnits(point: LatLon): PointUnits {
  const units = {
    lat: Math.round(point.lat * COORDINATE_SCALE),
    lon: Math.round(point.lon * COORDINATE_SCALE),
  };
  if (!unitsInRange(units)) throw new ProtocolFailure('invalid-value', 'coordinate out of range');
  return units;
}

function fromUnits(units: PointUnits): LatLon {
  return { lat: units.lat / COORDINATE_SCALE, lon: units.lon / COORDINATE_SCALE };
}

function unitsInRange(units: PointUnits): boolean {
  return (
    Number.isFinite(units.lat) &&
    Number.isFinite(units.lon) &&
    Math.abs(units.lat) <= MAX_LAT_UNITS &&
    Math.abs(units.lon) <= MAX_LON_UNITS
  );
}

function sameUnits(a: PointUnits, b: PointUnits): boolean {
  return a.lat === b.lat && a.lon === b.lon;
}

export function writePoint(writer: ByteWriter, point: LatLon): void {
  const units = toUnits(point);
  writer.i32(units.lat).i32(units.lon);
}

export function readPoint(reader: ByteReader): LatLon {
  const units = { lat: reader.i32(), lon: reader.i32() };
  if (!unitsInRange(units)) throw new ProtocolFailure('invalid-value', 'coordinate out of range');
  return fromUnits(units);
}

/**
 * Delta from `from` to `to` in delta units, rounded so the reconstructed point stays within the
 * valid range: near ±90° or ±180°, plain rounding could step just past the limit.
 */
function deltaWithinRange(from: number, to: number, limit: number): number {
  const delta = Math.round((to - from) / DELTA_UNIT);
  const reconstructed = from + delta * DELTA_UNIT;
  if (reconstructed > limit) return delta - 1;
  if (reconstructed < -limit) return delta + 1;
  return delta;
}

/**
 * Writes `count`, the first point and one i16 delta pair per further point. Each delta is taken
 * from the previously *reconstructed* point, so rounding never accumulates along the line.
 * For a closed shape (polygon), the reconstructed last point must differ from the first.
 */
export function writePointList(
  writer: ByteWriter,
  points: readonly LatLon[],
  closed: boolean,
): void {
  const [first, ...others] = points;
  if (first === undefined) throw new ProtocolFailure('invalid-value', 'point list is empty');

  writer.u8(points.length);
  const start = toUnits(first);
  writer.i32(start.lat).i32(start.lon);

  let previous = start;
  for (const point of others) {
    const target = toUnits(point);
    const dLat = deltaWithinRange(previous.lat, target.lat, MAX_LAT_UNITS);
    const dLon = deltaWithinRange(previous.lon, target.lon, MAX_LON_UNITS);
    if (dLat < I16_MIN || dLat > I16_MAX || dLon < I16_MIN || dLon > I16_MAX) {
      // The spec allows inserting intermediate points instead; that belongs to the caller,
      // which knows how the line should be densified.
      throw new ProtocolFailure('invalid-value', 'consecutive points are more than 0.32767° apart');
    }
    writer.i16(dLat).i16(dLon);
    previous = { lat: previous.lat + dLat * DELTA_UNIT, lon: previous.lon + dLon * DELTA_UNIT };
  }

  if (closed && sameUnits(previous, start)) {
    throw new ProtocolFailure(
      'invalid-value',
      'polygons are implicitly closed; drop the last point',
    );
  }
}

export function readPointList(reader: ByteReader, minPoints: number, closed: boolean): LatLon[] {
  const count = reader.u8();
  if (count < minPoints) {
    throw new ProtocolFailure('invalid-value', `need at least ${minPoints} points, got ${count}`);
  }
  const start: PointUnits = { lat: reader.i32(), lon: reader.i32() };
  if (!unitsInRange(start)) throw new ProtocolFailure('invalid-value', 'coordinate out of range');

  const points = [fromUnits(start)];
  let current = start;
  for (let i = 1; i < count; i++) {
    current = {
      lat: current.lat + reader.i16() * DELTA_UNIT,
      lon: current.lon + reader.i16() * DELTA_UNIT,
    };
    if (!unitsInRange(current)) {
      throw new ProtocolFailure('invalid-value', 'coordinate out of range');
    }
    points.push(fromUnits(current));
  }

  if (closed && sameUnits(current, start)) {
    throw new ProtocolFailure('invalid-value', 'polygon repeats its first point');
  }
  return points;
}
