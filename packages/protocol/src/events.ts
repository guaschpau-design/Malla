// Events as TypeScript values (docs/protocol.md §3). The codec converts between these and bytes.
//
// Units in this API are the natural ones — degrees, metres, metres per second — and the codec
// takes care of the integer representations on the wire.

/** §1 Node ID as 8 lowercase hex characters, e.g. "a1b2c3d4". */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** §1 Points to the event with this (origin, seq). */
export interface EventRef {
  readonly origin: NodeId;
  readonly seq: number;
}

/** §3.10 A map object is identified by the reference of the event that created it. */
export type ObjectRef = EventRef;

export interface LatLon {
  /** Degrees, -90 to 90. */
  readonly lat: number;
  /** Degrees, -180 to 180. */
  readonly lon: number;
}

/** §3.1 Fields common to every event. */
export interface EventHeader {
  readonly origin: NodeId;
  /** Per-origin sequence number, from 1. */
  readonly seq: number;
  /** Seconds since the Unix epoch. */
  readonly time: number;
}

export type Role = 'member' | 'coordinator';

export interface MemberInfoEvent extends EventHeader {
  readonly type: 'member-info';
  readonly role: Role;
  readonly publicKey: Uint8Array;
  readonly alias: string;
}

export interface PositionEvent extends EventHeader, LatLon {
  readonly type: 'position';
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
  /** Degrees clockwise from north, 0-359, or null if unknown. */
  readonly heading: number | null;
  /** Metres per second, or null if unknown. */
  readonly speed: number | null;
}

export interface PositionHiddenEvent extends EventHeader {
  readonly type: 'position-hidden';
}

export interface ChatEvent extends EventHeader {
  readonly type: 'chat';
  readonly text: string;
}

export interface MarkerEvent extends EventHeader, LatLon {
  readonly type: 'marker';
  readonly object: ObjectRef;
  /** §4.1 symbol code. */
  readonly symbol: number;
  readonly label: string;
}

export type ShapeGeometry =
  | { readonly kind: 'polyline'; readonly points: readonly LatLon[] }
  | { readonly kind: 'polygon'; readonly points: readonly LatLon[] }
  | { readonly kind: 'circle'; readonly center: LatLon; readonly radius: number };

export interface ShapeEvent extends EventHeader {
  readonly type: 'shape';
  readonly object: ObjectRef;
  /** §4.2 style code. */
  readonly style: number;
  readonly label: string;
  readonly geometry: ShapeGeometry;
}

export interface ObjectDeleteEvent extends EventHeader {
  readonly type: 'object-delete';
  readonly object: ObjectRef;
}

export type SosKind = 'general' | 'medical' | 'trapped' | 'fire' | 'security';

export interface SosEvent extends EventHeader, LatLon {
  readonly type: 'sos';
  readonly kind: SosKind;
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
  readonly text: string;
}

export interface SosCancelEvent extends EventHeader {
  readonly type: 'sos-cancel';
  readonly sos: EventRef;
}

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface AlertEvent extends EventHeader {
  readonly type: 'alert';
  readonly level: AlertLevel;
  readonly text: string;
}

export interface AckEvent extends EventHeader {
  readonly type: 'ack';
  readonly target: EventRef;
}

export type TaskStatus = 'open' | 'in-progress' | 'done' | 'cancelled';

/** §3.11 Creates or replaces a task. */
export interface TaskEvent extends EventHeader {
  readonly type: 'task';
  /** The reference of the event that created the task. */
  readonly task: EventRef;
  readonly status: TaskStatus;
  /** Who should do it, or null for anyone. */
  readonly assignee: NodeId | null;
  /** Where, or null for nowhere in particular. */
  readonly place: LatLon | null;
  readonly text: string;
}

export type TeselEvent =
  | MemberInfoEvent
  | PositionEvent
  | PositionHiddenEvent
  | ChatEvent
  | MarkerEvent
  | ShapeEvent
  | ObjectDeleteEvent
  | SosEvent
  | SosCancelEvent
  | AlertEvent
  | AckEvent
  | TaskEvent;

export type EventType = TeselEvent['type'];
