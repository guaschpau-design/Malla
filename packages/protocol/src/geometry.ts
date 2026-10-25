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
  const lat = Math.round(point.lat * COORDINATE_SCALE);
  const lon = Math.round(point.lon * COORDINATE_SCALE);
  checkUnits({ lat, lon });
  return { lat, lon };
}

function fromUnits(units: PointUnits): LatLon {
  return { lat: units.lat / COORDINATE_SCALE, lon: units.lon / COORDINATE_SCALE };
}

function checkUnits(units: PointUnits): void {
  if (
    !Number.isFinite(units.lat) ||
    !Number.isFinite(units.lon) ||
    Math.abs(units.lat) > MAX_LAT_UNITS ||
    Math.abs(units.lon) > MAX_LON_UNITS
  ) {
    throw new ProtocolFailure('invalid-value', 'coordinate out of range');
  }
}

export function writePoint(writer: ByteWriter, point: LatLon): void {
  const units = toUnits(point);
  writer.i32(units.lat).i32(units.lon);
}

export function readPoint(reader: ByteReader): LatLon {
  const units = { lat: reader.i32(), lon: reader.i32() };
  checkUnits(units);
  return fromUnits(units);
}

/**
 * Writes `count`, the first point and one i16 delta pair per further point. Each delta is taken
 * from the previously *reconstructed* point, so rounding never accumulates along the line.
 */
export function writePointList(writer: ByteWriter, points: readonly LatLon[]): void {
  const [first, ...others] = points;
  if (first === undefined) throw new ProtocolFailure('invalid-value', 'point list is empty');

  writer.u8(points.length);
  let previous = toUnits(first);
  writer.i32(previous.lat).i32(previous.lon);

  for (const point of others) {
    const target = toUnits(point);
    const dLat = Math.round((target.lat - previous.lat) / DELTA_UNIT);
    const dLon = Math.round((target.lon - previous.lon) / DELTA_UNIT);
    if (dLat < I16_MIN || dLat > I16_MAX || dLon < I16_MIN || dLon > I16_MAX) {
      // The spec allows inserting intermediate points instead; that belongs to the caller,
      // which knows how the line should be densified.
      throw new ProtocolFailure('invalid-value', 'consecutive points are more than 0.32767° apart');
    }
    writer.i16(dLat).i16(dLon);
    previous = { lat: previous.lat + dLat * DELTA_UNIT, lon: previous.lon + dLon * DELTA_UNIT };
    checkUnits(previous);
  }
}

export function readPointList(reader: ByteReader, minPoints: number): LatLon[] {
  const count = reader.u8();
  if (count < minPoints) {
    throw new ProtocolFailure('invalid-value', `need at least ${minPoints} points, got ${count}`);
  }
  let current: PointUnits = { lat: reader.i32(), lon: reader.i32() };
  checkUnits(current);
  const points = [fromUnits(current)];

  for (let i = 1; i < count; i++) {
    current = {
      lat: current.lat + reader.i16() * DELTA_UNIT,
      lon: current.lon + reader.i16() * DELTA_UNIT,
    };
    checkUnits(current);
    points.push(fromUnits(current));
  }
  return points;
}
