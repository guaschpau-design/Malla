// Event encoding and decoding (docs/protocol.md §3).

import { ByteReader, ByteWriter, encodeUtf8, ProtocolFailure } from './bytes.ts';
import {
  ALIAS_MAX_BYTES,
  ALIAS_MIN_BYTES,
  EventTypeCode,
  HEADER_SIZE,
  MAX_EVENT_SIZE,
  NODE_ID_SIZE,
  PROTOCOL_VERSION,
  PUBLIC_KEY_SIZE,
  SHAPE_LABEL_MAX_BYTES,
  ShapeKindCode,
  UNKNOWN_U16,
} from './constants.ts';
import type {
  AlertLevel,
  EventHeader,
  EventRef,
  MallaEvent,
  Role,
  ShapeGeometry,
  SosKind,
} from './events.ts';
import { readPoint, readPointList, writePoint, writePointList } from './geometry.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';
import { err, ok, type ProtocolError, type Result } from './result.ts';

// Text limits per type. Each equals the payload budget left after the type's fixed fields.
const CHAT_MAX_BYTES = MAX_EVENT_SIZE - HEADER_SIZE; // §3.5
const MARKER_LABEL_MAX_BYTES = MAX_EVENT_SIZE - HEADER_SIZE - 18; // §3.6
const SOS_TEXT_MAX_BYTES = MAX_EVENT_SIZE - HEADER_SIZE - 11; // §3.8
const ALERT_TEXT_MAX_BYTES = MAX_EVENT_SIZE - HEADER_SIZE - 1; // §3.9

const ROLES: readonly Role[] = ['member', 'coordinator']; // §3.3
const SOS_KINDS: readonly SosKind[] = ['general', 'medical', 'trapped', 'fire', 'security']; // §3.8
const ALERT_LEVELS: readonly AlertLevel[] = ['info', 'warning', 'critical']; // §3.9

/** Encodes an event. Fails if a field is out of range or the result exceeds 165 bytes. */
export function encodeEvent(event: MallaEvent): Result<Uint8Array, ProtocolError> {
  try {
    const writer = new ByteWriter();
    writeHeader(writer, event);
    writePayload(writer, event);
    if (writer.length > MAX_EVENT_SIZE) {
      return err({
        code: 'too-large',
        detail: `event is ${writer.length} bytes, maximum ${MAX_EVENT_SIZE}`,
      });
    }
    return ok(writer.toBytes());
  } catch (failure) {
    return asError(failure);
  }
}

/** Decodes an event. Never throws, whatever the input. */
export function decodeEvent(bytes: Uint8Array): Result<MallaEvent, ProtocolError> {
  try {
    if (bytes.length > MAX_EVENT_SIZE) {
      return err({ code: 'too-large', detail: `input is ${bytes.length} bytes` });
    }
    const reader = new ByteReader(bytes);
    const version = reader.u8();
    if (version !== PROTOCOL_VERSION) {
      return err({ code: 'unsupported-version', detail: `version ${version}` });
    }
    const typeCode = reader.u8();
    const header = readHeaderFields(reader);
    const event = readPayload(reader, typeCode, header);
    reader.end();
    return ok(event);
  } catch (failure) {
    return asError(failure);
  }
}

function asError(failure: unknown): { readonly ok: false; readonly error: ProtocolError } {
  if (failure instanceof ProtocolFailure) return err(failure.error);
  throw failure; // A programming error, not bad input: let it surface.
}

// --- Header ------------------------------------------------------------------------------

function writeHeader(writer: ByteWriter, event: MallaEvent): void {
  if (event.seq < 1) throw new ProtocolFailure('invalid-value', 'seq must be at least 1');
  writer
    .u8(PROTOCOL_VERSION)
    .u8(typeCodeOf(event))
    .raw(nodeIdToBytes(event.origin))
    .u32(event.seq)
    .u32(event.time);
}

function readHeaderFields(reader: ByteReader): EventHeader {
  const origin = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  const seq = reader.u32();
  const time = reader.u32();
  if (seq < 1) throw new ProtocolFailure('invalid-value', 'seq must be at least 1');
  return { origin, seq, time };
}

function typeCodeOf(event: MallaEvent): number {
  switch (event.type) {
    case 'member-info':
      return EventTypeCode.MEMBER_INFO;
    case 'position':
      return EventTypeCode.POSITION;
    case 'position-hidden':
      return EventTypeCode.POSITION_HIDDEN;
    case 'chat':
      return EventTypeCode.CHAT;
    case 'marker':
      return EventTypeCode.MARKER;
    case 'shape':
      return EventTypeCode.SHAPE;
    case 'object-delete':
      return EventTypeCode.OBJECT_DELETE;
    case 'sos':
      return EventTypeCode.SOS;
    case 'sos-cancel':
      return EventTypeCode.SOS_CANCEL;
    case 'alert':
      return EventTypeCode.ALERT;
    case 'ack':
      return EventTypeCode.ACK;
  }
}

// --- Payloads ----------------------------------------------------------------------------

function writePayload(writer: ByteWriter, event: MallaEvent): void {
  switch (event.type) {
    case 'member-info':
      if (event.publicKey.length !== PUBLIC_KEY_SIZE) {
        throw new ProtocolFailure('invalid-value', 'public key must be 32 bytes');
      }
      writer.u8(ROLES.indexOf(event.role)).raw(event.publicKey);
      writeTextRest(writer, event.alias, ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
      return;
    case 'position':
      writePoint(writer, event);
      writer
        .u16(measurement(event.accuracy, 1))
        .u16(event.heading === null ? UNKNOWN_U16 : Math.round(event.heading) % 360)
        .u16(measurement(event.speed, 100));
      return;
    case 'position-hidden':
      return;
    case 'chat':
      writeTextRest(writer, event.text, 1, CHAT_MAX_BYTES, 'chat text');
      return;
    case 'marker':
      writeRef(writer, event.object);
      writer.u16(event.symbol);
      writePoint(writer, event);
      writeTextRest(writer, event.label, 0, MARKER_LABEL_MAX_BYTES, 'marker label');
      return;
    case 'shape':
      writeRef(writer, event.object);
      writer.u8(shapeKindCode(event.geometry)).u16(event.style);
      writer.textU8(event.label, 0, SHAPE_LABEL_MAX_BYTES, 'shape label');
      writeGeometry(writer, event.geometry);
      return;
    case 'object-delete':
      writeRef(writer, event.object);
      return;
    case 'sos':
      writer.u8(SOS_KINDS.indexOf(event.kind));
      writePoint(writer, event);
      writer.u16(measurement(event.accuracy, 1));
      writeTextRest(writer, event.text, 0, SOS_TEXT_MAX_BYTES, 'SOS text');
      return;
    case 'sos-cancel':
      writeRef(writer, event.sos);
      return;
    case 'alert':
      writer.u8(ALERT_LEVELS.indexOf(event.level));
      writeTextRest(writer, event.text, 1, ALERT_TEXT_MAX_BYTES, 'alert text');
      return;
    case 'ack':
      writeRef(writer, event.target);
      return;
  }
}

function readPayload(reader: ByteReader, typeCode: number, header: EventHeader): MallaEvent {
  switch (typeCode) {
    case EventTypeCode.MEMBER_INFO: {
      const role = valueAt(ROLES, reader.u8(), 'role');
      const publicKey = reader.raw(PUBLIC_KEY_SIZE);
      const alias = reader.textRest(ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
      return { ...header, type: 'member-info', role, publicKey, alias };
    }
    case EventTypeCode.POSITION: {
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, 1);
      const rawHeading = reader.u16();
      if (rawHeading !== UNKNOWN_U16 && rawHeading > 359) {
        throw new ProtocolFailure('invalid-value', `heading ${rawHeading}`);
      }
      const heading = rawHeading === UNKNOWN_U16 ? null : rawHeading;
      const speed = readMeasurement(reader, 100);
      return { ...header, type: 'position', ...point, accuracy, heading, speed };
    }
    case EventTypeCode.POSITION_HIDDEN:
      return { ...header, type: 'position-hidden' };
    case EventTypeCode.CHAT:
      return { ...header, type: 'chat', text: reader.textRest(1, CHAT_MAX_BYTES, 'chat text') };
    case EventTypeCode.MARKER: {
      const object = readRef(reader);
      const symbol = reader.u16();
      const point = readPoint(reader);
      const label = reader.textRest(0, MARKER_LABEL_MAX_BYTES, 'marker label');
      return { ...header, type: 'marker', object, symbol, ...point, label };
    }
    case EventTypeCode.SHAPE: {
      const object = readRef(reader);
      const kindCode = reader.u8();
      const style = reader.u16();
      const label = reader.textU8(0, SHAPE_LABEL_MAX_BYTES, 'shape label');
      const geometry = readGeometry(reader, kindCode);
      return { ...header, type: 'shape', object, style, label, geometry };
    }
    case EventTypeCode.OBJECT_DELETE:
      return { ...header, type: 'object-delete', object: readRef(reader) };
    case EventTypeCode.SOS: {
      // §3.8: reserved kinds are shown as general.
      const kind = SOS_KINDS[reader.u8()] ?? 'general';
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, 1);
      const text = reader.textRest(0, SOS_TEXT_MAX_BYTES, 'SOS text');
      return { ...header, type: 'sos', kind, ...point, accuracy, text };
    }
    case EventTypeCode.SOS_CANCEL:
      return { ...header, type: 'sos-cancel', sos: readRef(reader) };
    case EventTypeCode.ALERT: {
      const level = valueAt(ALERT_LEVELS, reader.u8(), 'alert level');
      const text = reader.textRest(1, ALERT_TEXT_MAX_BYTES, 'alert text');
      return { ...header, type: 'alert', level, text };
    }
    case EventTypeCode.ACK:
      return { ...header, type: 'ack', target: readRef(reader) };
    default:
      throw new ProtocolFailure('unknown-type', `type code 0x${typeCode.toString(16)}`);
  }
}

// --- Field helpers -----------------------------------------------------------------------

function writeRef(writer: ByteWriter, ref: EventRef): void {
  if (ref.seq < 1) throw new ProtocolFailure('invalid-value', 'reference seq must be at least 1');
  writer.raw(nodeIdToBytes(ref.origin)).u32(ref.seq);
}

function readRef(reader: ByteReader): EventRef {
  const origin = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  const seq = reader.u32();
  if (seq < 1) throw new ProtocolFailure('invalid-value', 'reference seq must be at least 1');
  return { origin, seq };
}

function writeTextRest(
  writer: ByteWriter,
  text: string,
  minBytes: number,
  maxBytes: number,
  field: string,
): void {
  const before = writer.length;
  writer.raw(encodeUtf8(text));
  const length = writer.length - before;
  if (length < minBytes || length > maxBytes) {
    throw new ProtocolFailure(
      length > maxBytes ? 'too-large' : 'invalid-value',
      `${field} must be ${minBytes}-${maxBytes} bytes, got ${length}`,
    );
  }
}

/**
 * A non-negative measurement stored as u16 in `1/scale` of its unit, saturating just below the
 * "unknown" marker so that a huge value is never mistaken for an unknown one.
 */
function measurement(value: number | null, scale: number): number {
  if (value === null) return UNKNOWN_U16;
  if (!Number.isFinite(value) || value < 0) {
    throw new ProtocolFailure('invalid-value', `measurement ${String(value)}`);
  }
  return Math.min(Math.round(value * scale), UNKNOWN_U16 - 1);
}

function readMeasurement(reader: ByteReader, scale: number): number | null {
  const raw = reader.u16();
  return raw === UNKNOWN_U16 ? null : raw / scale;
}

function shapeKindCode(geometry: ShapeGeometry): number {
  switch (geometry.kind) {
    case 'polyline':
      return ShapeKindCode.POLYLINE;
    case 'polygon':
      return ShapeKindCode.POLYGON;
    case 'circle':
      return ShapeKindCode.CIRCLE;
  }
}

function writeGeometry(writer: ByteWriter, geometry: ShapeGeometry): void {
  switch (geometry.kind) {
    case 'polyline':
      requireCount(geometry.points.length, 2, 'polyline');
      writePointList(writer, geometry.points);
      return;
    case 'polygon': {
      requireCount(geometry.points.length, 3, 'polygon');
      const first = geometry.points[0];
      const last = geometry.points[geometry.points.length - 1];
      if (first?.lat === last?.lat && first?.lon === last?.lon) {
        throw new ProtocolFailure(
          'invalid-value',
          'polygons are implicitly closed; drop the last point',
        );
      }
      writePointList(writer, geometry.points);
      return;
    }
    case 'circle':
      if (!Number.isFinite(geometry.radius) || geometry.radius < 1) {
        throw new ProtocolFailure('invalid-value', 'circle radius must be at least 1 m');
      }
      writePoint(writer, geometry.center);
      writer.u32(Math.round(geometry.radius));
      return;
  }
}

function readGeometry(reader: ByteReader, kindCode: number): ShapeGeometry {
  switch (kindCode) {
    case ShapeKindCode.POLYLINE:
      return { kind: 'polyline', points: readPointList(reader, 2) };
    case ShapeKindCode.POLYGON:
      return { kind: 'polygon', points: readPointList(reader, 3) };
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

function valueAt<T>(values: readonly T[], index: number, field: string): T {
  const value = values[index];
  if (value === undefined) throw new ProtocolFailure('invalid-value', `${field} ${index}`);
  return value;
}
