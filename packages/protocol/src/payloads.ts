// The payload of every event type (docs/protocol.md §3.3–§3.12), each written next to the code
// that reads it, so that the two halves of a layout cannot drift apart. Adding an event type
// means adding its entry here: the record is keyed by every `EventType`, so the compiler refuses
// a type without a layout.

import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import {
  ALIAS_MAX_BYTES,
  ALIAS_MIN_BYTES,
  EventTypeCode,
  PUBLIC_KEY_SIZE,
  SHAPE_LABEL_MAX_BYTES,
  UNKNOWN_U16,
} from './constants.ts';
import { nodeIdFromPublicKey } from './crypto.ts';
import type { EventHeader, EventType, MemberInfoEvent, TeselEvent } from './events.ts';
import {
  ALERT_LEVELS,
  ALERT_TEXT_MAX_BYTES,
  CHAT_MAX_BYTES,
  enumCode,
  enumValue,
  MARKER_LABEL_MAX_BYTES,
  readAssignee,
  readGeometry,
  readMeasurement,
  readPlace,
  readRef,
  ROLES,
  shapeKindCode,
  SOS_KINDS,
  SOS_TEXT_MAX_BYTES,
  TASK_STATUSES,
  ROLL_CALL_TEXT_MAX_BYTES,
  TASK_TEXT_MAX_BYTES,
  writeAssignee,
  writeGeometry,
  writeMeasurement,
  writePlace,
  writeRef,
  writeTextRest,
} from './fields.ts';
import { readPoint, writePoint } from './geometry.ts';

/** How one event type is laid out after the header. */
export interface PayloadCodec<E extends TeselEvent> {
  /** §3.2 type code. */
  readonly code: number;
  write(writer: ByteWriter, event: E): void;
  read(reader: ByteReader, header: EventHeader): E;
}

type EventOfType<K extends EventType> = Extract<TeselEvent, { readonly type: K }>;

export const PAYLOADS: { readonly [K in EventType]: PayloadCodec<EventOfType<K>> } = {
  // §3.3
  'member-info': {
    code: EventTypeCode.MEMBER_INFO,
    write(writer, event) {
      checkMemberKey(event);
      writer.u8(enumCode(ROLES, event.role, 'role')).raw(event.publicKey);
      writeTextRest(writer, event.alias, ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
    },
    read(reader, header) {
      const role = enumValue(ROLES, reader.u8(), 'member');
      const publicKey = reader.raw(PUBLIC_KEY_SIZE);
      const alias = reader.textRest(ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
      const event: MemberInfoEvent = { ...header, type: 'member-info', role, publicKey, alias };
      checkMemberKey(event);
      return event;
    },
  },
  // §3.4
  position: {
    code: EventTypeCode.POSITION,
    write(writer, event) {
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, 1);
      writer.u16(event.heading === null ? UNKNOWN_U16 : Math.round(event.heading) % 360);
      writeMeasurement(writer, event.speed, 100);
    },
    read(reader, header) {
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, 1);
      const rawHeading = reader.u16();
      if (rawHeading !== UNKNOWN_U16 && rawHeading > 359) {
        throw new ProtocolFailure('invalid-value', `heading ${rawHeading}`);
      }
      const heading = rawHeading === UNKNOWN_U16 ? null : rawHeading;
      const speed = readMeasurement(reader, 100);
      return { ...header, type: 'position', ...point, accuracy, heading, speed };
    },
  },
  // §3.4: empty payload
  'position-hidden': {
    code: EventTypeCode.POSITION_HIDDEN,
    write() {},
    read: (_reader, header) => ({ ...header, type: 'position-hidden' }),
  },
  // §3.5
  chat: {
    code: EventTypeCode.CHAT,
    write(writer, event) {
      writeTextRest(writer, event.text, 1, CHAT_MAX_BYTES, 'chat text');
    },
    read: (reader, header) => ({
      ...header,
      type: 'chat',
      text: reader.textRest(1, CHAT_MAX_BYTES, 'chat text'),
    }),
  },
  // §3.6
  marker: {
    code: EventTypeCode.MARKER,
    write(writer, event) {
      writeRef(writer, event.object);
      writer.u16(event.symbol);
      writePoint(writer, event);
      writeTextRest(writer, event.label, 0, MARKER_LABEL_MAX_BYTES, 'marker label');
    },
    read(reader, header) {
      const object = readRef(reader);
      const symbol = reader.u16();
      const point = readPoint(reader);
      const label = reader.textRest(0, MARKER_LABEL_MAX_BYTES, 'marker label');
      return { ...header, type: 'marker', object, symbol, ...point, label };
    },
  },
  // §3.7
  shape: {
    code: EventTypeCode.SHAPE,
    write(writer, event) {
      writeRef(writer, event.object);
      writer.u8(shapeKindCode(event.geometry)).u16(event.style);
      writer.textU8(event.label, 0, SHAPE_LABEL_MAX_BYTES, 'shape label');
      writeGeometry(writer, event.geometry);
    },
    read(reader, header) {
      const object = readRef(reader);
      const kindCode = reader.u8();
      const style = reader.u16();
      const label = reader.textU8(0, SHAPE_LABEL_MAX_BYTES, 'shape label');
      const geometry = readGeometry(reader, kindCode);
      return { ...header, type: 'shape', object, style, label, geometry };
    },
  },
  // §3.10: the object reference
  'object-delete': {
    code: EventTypeCode.OBJECT_DELETE,
    write(writer, event) {
      writeRef(writer, event.object);
    },
    read: (reader, header) => ({ ...header, type: 'object-delete', object: readRef(reader) }),
  },
  // §3.8
  sos: {
    code: EventTypeCode.SOS,
    write(writer, event) {
      writer.u8(enumCode(SOS_KINDS, event.kind, 'SOS kind'));
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, 1);
      writeTextRest(writer, event.text, 0, SOS_TEXT_MAX_BYTES, 'SOS text');
    },
    read(reader, header) {
      const kind = enumValue(SOS_KINDS, reader.u8(), 'general');
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, 1);
      const text = reader.textRest(0, SOS_TEXT_MAX_BYTES, 'SOS text');
      return { ...header, type: 'sos', kind, ...point, accuracy, text };
    },
  },
  // §3.2: the reference of the SOS being cancelled
  'sos-cancel': {
    code: EventTypeCode.SOS_CANCEL,
    write(writer, event) {
      writeRef(writer, event.sos);
    },
    read: (reader, header) => ({ ...header, type: 'sos-cancel', sos: readRef(reader) }),
  },
  // §3.9
  alert: {
    code: EventTypeCode.ALERT,
    write(writer, event) {
      writer.u8(enumCode(ALERT_LEVELS, event.level, 'alert level'));
      writeTextRest(writer, event.text, 1, ALERT_TEXT_MAX_BYTES, 'alert text');
    },
    read(reader, header) {
      const level = enumValue(ALERT_LEVELS, reader.u8(), 'warning');
      const text = reader.textRest(1, ALERT_TEXT_MAX_BYTES, 'alert text');
      return { ...header, type: 'alert', level, text };
    },
  },
  // §3.2: the reference of the event acknowledged
  ack: {
    code: EventTypeCode.ACK,
    write(writer, event) {
      writeRef(writer, event.target);
    },
    read: (reader, header) => ({ ...header, type: 'ack', target: readRef(reader) }),
  },
  // §3.11
  task: {
    code: EventTypeCode.TASK,
    write(writer, event) {
      writeRef(writer, event.task);
      writer.u8(enumCode(TASK_STATUSES, event.status, 'task status'));
      writeAssignee(writer, event.assignee);
      writePlace(writer, event.place);
      writeTextRest(writer, event.text, 1, TASK_TEXT_MAX_BYTES, 'task text');
    },
    read(reader, header) {
      const task = readRef(reader);
      const status = enumValue(TASK_STATUSES, reader.u8(), 'open');
      const assignee = readAssignee(reader);
      const place = readPlace(reader);
      const text = reader.textRest(1, TASK_TEXT_MAX_BYTES, 'task text');
      return { ...header, type: 'task', task, status, assignee, place, text };
    },
  },
  // §3.12
  'roll-call': {
    code: EventTypeCode.ROLL_CALL,
    write(writer, event) {
      writeTextRest(writer, event.text, 0, ROLL_CALL_TEXT_MAX_BYTES, 'roll call text');
    },
    read: (reader, header) => ({
      ...header,
      type: 'roll-call',
      text: reader.textRest(0, ROLL_CALL_TEXT_MAX_BYTES, 'roll call text'),
    }),
  },
};

/** Every event type this version knows, in type-code order. */
export const EVENT_TYPES: readonly EventType[] = (Object.keys(PAYLOADS) as EventType[]).sort(
  (a, b) => PAYLOADS[a].code - PAYLOADS[b].code,
);

const BY_CODE: ReadonlyMap<number, PayloadCodec<TeselEvent>> = new Map(
  EVENT_TYPES.map((type) => [PAYLOADS[type].code, PAYLOADS[type]]),
);

/**
 * The layout of an event's own type. TypeScript cannot relate a key of a mapped type to the
 * matching value once the key is a union, hence the assertion. It is safe: each entry of PAYLOADS
 * writes and reads exactly the events of its own key.
 */
export function payloadOf<E extends TeselEvent>(event: E): PayloadCodec<E> {
  return PAYLOADS[event.type] as PayloadCodec<E>;
}

/** The layout of a type code, or undefined for a type this version does not know. */
export function payloadOfCode(code: number): PayloadCodec<TeselEvent> | undefined {
  return BY_CODE.get(code);
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
