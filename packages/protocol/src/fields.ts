// Payload field helpers shared by the codec: references, texts, measurements, enumerations and
// shape geometry (docs/protocol.md §1, §3).

import { ByteReader, ByteWriter, encodeUtf8, ProtocolFailure } from './bytes.ts';
import {
  EVENT_REF_SIZE,
  HEADER_SIZE,
  MAX_EVENT_SIZE,
  NODE_ID_SIZE,
  POINT_SIZE,
  ShapeKindCode,
  UNKNOWN_U16,
} from './constants.ts';
import type { AlertLevel, EventRef, Role, ShapeGeometry, SosKind } from './events.ts';
import { readPoint, readPointList, writePoint, writePointList } from './geometry.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';

// --- Text limits: each is the payload budget left after the type's fixed fields -----------

const PAYLOAD_BUDGET = MAX_EVENT_SIZE - HEADER_SIZE;
const SYMBOL_SIZE = 2;
const KIND_SIZE = 1;
const ACCURACY_SIZE = 2;

export const CHAT_MAX_BYTES = PAYLOAD_BUDGET; // §3.5
export const MARKER_LABEL_MAX_BYTES = PAYLOAD_BUDGET - EVENT_REF_SIZE - SYMBOL_SIZE - POINT_SIZE; // §3.6
export const SOS_TEXT_MAX_BYTES = PAYLOAD_BUDGET - KIND_SIZE - POINT_SIZE - ACCURACY_SIZE; // §3.8
export const ALERT_TEXT_MAX_BYTES = PAYLOAD_BUDGET - KIND_SIZE; // §3.9

// --- Enumerations ------------------------------------------------------------------------
// §3.1: a reserved value decodes to its documented default rather than rejecting the event,
// so that newer senders never make older receivers drop information.

export const ROLES: readonly Role[] = ['member', 'coordinator']; // §3.3, default member
export const SOS_KINDS: readonly SosKind[] = ['general', 'medical', 'trapped', 'fire', 'security']; // §3.8, default general
export const ALERT_LEVELS: readonly AlertLevel[] = ['info', 'warning', 'critical']; // §3.9, default warning

export function enumCode<T>(values: readonly T[], value: T, field: string): number {
  const code = values.indexOf(value);
  if (code < 0) throw new ProtocolFailure('invalid-value', `unknown ${field}`);
  return code;
}

export function enumValue<T>(values: readonly T[], code: number, fallback: T): T {
  return values[code] ?? fallback;
}

// --- References --------------------------------------------------------------------------

export function writeRef(writer: ByteWriter, ref: EventRef): void {
  if (ref.seq < 1) throw new ProtocolFailure('invalid-value', 'reference seq must be at least 1');
  writer.raw(nodeIdToBytes(ref.origin)).u32(ref.seq);
}

export function readRef(reader: ByteReader): EventRef {
  const origin = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  const seq = reader.u32();
  if (seq < 1) throw new ProtocolFailure('invalid-value', 'reference seq must be at least 1');
  return { origin, seq };
}

// --- Text --------------------------------------------------------------------------------

export function writeTextRest(
  writer: ByteWriter,
  text: string,
  minBytes: number,
  maxBytes: number,
  field: string,
): void {
  const data = encodeUtf8(text);
  if (data.length > maxBytes) {
    throw new ProtocolFailure('too-large', `${field} is ${data.length} bytes, maximum ${maxBytes}`);
  }
  if (data.length < minBytes) {
    throw new ProtocolFailure('invalid-value', `${field} needs at least ${minBytes} bytes`);
  }
  writer.raw(data);
}

// --- Measurements ------------------------------------------------------------------------

/**
 * A non-negative measurement stored as u16 in `1/scale` of its unit, saturating just below the
 * "unknown" marker so that a huge value is never mistaken for an unknown one.
 */
export function writeMeasurement(writer: ByteWriter, value: number | null, scale: number): void {
  if (value === null) {
    writer.u16(UNKNOWN_U16);
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new ProtocolFailure('invalid-value', `measurement ${String(value)}`);
  }
  writer.u16(Math.min(Math.round(value * scale), UNKNOWN_U16 - 1));
}

export function readMeasurement(reader: ByteReader, scale: number): number | null {
  const raw = reader.u16();
  return raw === UNKNOWN_U16 ? null : raw / scale;
}

// --- Shape geometry (§3.7) ---------------------------------------------------------------

export function shapeKindCode(geometry: ShapeGeometry): number {
  switch (geometry.kind) {
    case 'polyline':
      return ShapeKindCode.POLYLINE;
    case 'polygon':
      return ShapeKindCode.POLYGON;
    case 'circle':
      return ShapeKindCode.CIRCLE;
  }
}

export function writeGeometry(writer: ByteWriter, geometry: ShapeGeometry): void {
  switch (geometry.kind) {
    case 'polyline':
      requireCount(geometry.points.length, 2, 'polyline');
      writePointList(writer, geometry.points, false);
      return;
    case 'polygon':
      requireCount(geometry.points.length, 3, 'polygon');
      writePointList(writer, geometry.points, true);
      return;
    case 'circle':
      if (!Number.isFinite(geometry.radius) || geometry.radius < 1) {
        throw new ProtocolFailure('invalid-value', 'circle radius must be at least 1 m');
      }
      writePoint(writer, geometry.center);
      writer.u32(Math.round(geometry.radius));
      return;
  }
}

/** §3.7: a reserved shape kind cannot be parsed, so the event is rejected. */
export function readGeometry(reader: ByteReader, kindCode: number): ShapeGeometry {
  switch (kindCode) {
    case ShapeKindCode.POLYLINE:
      return { kind: 'polyline', points: readPointList(reader, 2, false) };
    case ShapeKindCode.POLYGON:
      return { kind: 'polygon', points: readPointList(reader, 3, true) };
    case ShapeKindCode.CIRCLE: {
      const center = readPoint(reader);
      const radius = reader.u32();
      if (radius < 1) throw new ProtocolFailure('invalid-value', 'circle radius is 0');
      return { kind: 'circle', center, radius };
    }
    default:
      throw new ProtocolFailure('invalid-value', `shape kind ${kindCode}`);
  }
}

function requireCount(count: number, min: number, kind: string): void {
  if (count < min) throw new ProtocolFailure('invalid-value', `${kind} needs ${min}+ points`);
}
