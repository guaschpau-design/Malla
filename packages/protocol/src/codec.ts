// Event encoding and decoding (docs/protocol.md §3). Field helpers live in fields.ts.

import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import {
  ALIAS_MAX_BYTES,
  ALIAS_MIN_BYTES,
  EventTypeCode,
  MAX_EVENT_SIZE,
  NODE_ID_SIZE,
  PROTOCOL_VERSION,
  PUBLIC_KEY_SIZE,
  SHAPE_LABEL_MAX_BYTES,
  UNKNOWN_U16,
} from './constants.ts';
import { nodeIdFromPublicKey } from './crypto.ts';
import type { EventHeader, TeselEvent, MemberInfoEvent } from './events.ts';
import {
  ALERT_LEVELS,
  ALERT_TEXT_MAX_BYTES,
  CHAT_MAX_BYTES,
  enumCode,
  enumValue,
  MARKER_LABEL_MAX_BYTES,
  readGeometry,
  readMeasurement,
  readRef,
  ROLES,
  shapeKindCode,
  SOS_KINDS,
  SOS_TEXT_MAX_BYTES,
  writeGeometry,
  writeMeasurement,
  writeRef,
  writeTextRest,
} from './fields.ts';
import { readPoint, writePoint } from './geometry.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';
import { err, ok, type ProtocolError, type Result } from './result.ts';

/** A decoded header plus the raw type code, which may belong to a type we do not know. */
export interface RawHeader extends EventHeader {
  readonly typeCode: number;
}

/** Encodes an event. Fails if a field is out of range or the result exceeds 165 bytes. */
export function encodeEvent(event: TeselEvent): Result<Uint8Array, ProtocolError> {
  return catchFailure(() => {
    const writer = new ByteWriter();
    writeHeader(writer, event);
    writePayload(writer, event);
    if (writer.length > MAX_EVENT_SIZE) {
      throw new ProtocolFailure('too-large', `event is ${writer.length} bytes`);
    }
    return writer.toBytes();
  });
}

/**
 * Reads only the header. Works for event types this implementation does not know, so that
 * bridges can de-duplicate and forward them unchanged (§3.1).
 */
export function peekHeader(bytes: Uint8Array): Result<RawHeader, ProtocolError> {
  return catchFailure(() => readHeader(new ByteReader(bytes), bytes.length));
}

/** Decodes an event. Never throws, whatever the input. */
export function decodeEvent(bytes: Uint8Array): Result<TeselEvent, ProtocolError> {
  return catchFailure(() => {
    const reader = new ByteReader(bytes);
    const { typeCode, ...header } = readHeader(reader, bytes.length);
    const event = readPayload(reader, typeCode, header);
    reader.end();
    return event;
  });
}

function catchFailure<T>(work: () => T): Result<T, ProtocolError> {
  try {
    return ok(work());
  } catch (failure) {
    if (failure instanceof ProtocolFailure) return err(failure.error);
    throw failure; // A programming error, not bad input: let it surface.
  }
}

// --- Header (§3.1) -----------------------------------------------------------------------

function writeHeader(writer: ByteWriter, event: TeselEvent): void {
  if (event.seq < 1) throw new ProtocolFailure('invalid-value', 'seq must be at least 1');
  writer
    .u8(PROTOCOL_VERSION)
    .u8(EventTypeCode[typeKey(event)])
    .raw(nodeIdToBytes(event.origin))
    .u32(event.seq)
    .u32(event.time);
}

function readHeader(reader: ByteReader, totalLength: number): RawHeader {
  if (totalLength > MAX_EVENT_SIZE) {
    throw new ProtocolFailure('too-large', `input is ${totalLength} bytes`);
  }
  const version = reader.u8();
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolFailure('unsupported-version', `version ${version}`);
  }
  const typeCode = reader.u8();
  const origin = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  const seq = reader.u32();
  const time = reader.u32();
  if (seq < 1) throw new ProtocolFailure('invalid-value', 'seq must be at least 1');
  return { typeCode, origin, seq, time };
}

function typeKey(event: TeselEvent): keyof typeof EventTypeCode {
  switch (event.type) {
    case 'member-info':
      return 'MEMBER_INFO';
    case 'position':
      return 'POSITION';
    case 'position-hidden':
      return 'POSITION_HIDDEN';
    case 'chat':
      return 'CHAT';
    case 'marker':
      return 'MARKER';
    case 'shape':
      return 'SHAPE';
    case 'object-delete':
      return 'OBJECT_DELETE';
    case 'sos':
      return 'SOS';
    case 'sos-cancel':
      return 'SOS_CANCEL';
    case 'alert':
      return 'ALERT';
    case 'ack':
      return 'ACK';
  }
}

// --- Payloads (§3.3–§3.9) ----------------------------------------------------------------

function writePayload(writer: ByteWriter, event: TeselEvent): void {
  switch (event.type) {
    case 'member-info':
      checkMemberKey(event);
      writer.u8(enumCode(ROLES, event.role, 'role')).raw(event.publicKey);
      writeTextRest(writer, event.alias, ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
      return;
    case 'position':
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, 1);
      writer.u16(event.heading === null ? UNKNOWN_U16 : Math.round(event.heading) % 360);
      writeMeasurement(writer, event.speed, 100);
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
      writer.u8(enumCode(SOS_KINDS, event.kind, 'SOS kind'));
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, 1);
      writeTextRest(writer, event.text, 0, SOS_TEXT_MAX_BYTES, 'SOS text');
      return;
    case 'sos-cancel':
      writeRef(writer, event.sos);
      return;
    case 'alert':
      writer.u8(enumCode(ALERT_LEVELS, event.level, 'alert level'));
      writeTextRest(writer, event.text, 1, ALERT_TEXT_MAX_BYTES, 'alert text');
      return;
    case 'ack':
      writeRef(writer, event.target);
      return;
  }
}

function readPayload(reader: ByteReader, typeCode: number, header: EventHeader): TeselEvent {
  switch (typeCode) {
    case EventTypeCode.MEMBER_INFO: {
      const role = enumValue(ROLES, reader.u8(), 'member');
      const publicKey = reader.raw(PUBLIC_KEY_SIZE);
      const alias = reader.textRest(ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
      const event: MemberInfoEvent = { ...header, type: 'member-info', role, publicKey, alias };
      checkMemberKey(event);
      return event;
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
      const kind = enumValue(SOS_KINDS, reader.u8(), 'general');
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, 1);
      const text = reader.textRest(0, SOS_TEXT_MAX_BYTES, 'SOS text');
      return { ...header, type: 'sos', kind, ...point, accuracy, text };
    }
    case EventTypeCode.SOS_CANCEL:
      return { ...header, type: 'sos-cancel', sos: readRef(reader) };
    case EventTypeCode.ALERT: {
      const level = enumValue(ALERT_LEVELS, reader.u8(), 'warning');
      const text = reader.textRest(1, ALERT_TEXT_MAX_BYTES, 'alert text');
      return { ...header, type: 'alert', level, text };
    }
    case EventTypeCode.ACK:
      return { ...header, type: 'ack', target: readRef(reader) };
    default:
      throw new ProtocolFailure('unknown-type', `type code 0x${typeCode.toString(16)}`);
  }
}

/** §3.3: the public key must hash to the origin's node ID. */
function checkMemberKey(event: MemberInfoEvent): void {
  if (event.publicKey.length !== PUBLIC_KEY_SIZE) {
    throw new ProtocolFailure('invalid-value', 'public key must be 32 bytes');
  }
  if (nodeIdFromPublicKey(event.publicKey) !== event.origin) {
    throw new ProtocolFailure('invalid-value', 'public key does not match the origin node ID');
  }
}
