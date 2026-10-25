// Every numeric constant of the wire format. Section numbers refer to docs/protocol.md.

/** §3.1 Protocol version carried in every event header. */
export const PROTOCOL_VERSION = 1;

/** §2 Largest MeshCore channel datagram payload, and therefore the largest event. */
export const MAX_EVENT_SIZE = 165;

/** §3.1 Size of the event header. */
export const HEADER_SIZE = 14;

/** §1 Size of a node ID. */
export const NODE_ID_SIZE = 4;

/** §1 Size of an event reference: node ID plus u32 sequence number. */
export const EVENT_REF_SIZE = NODE_ID_SIZE + 4;

/** §1 Coordinates are integers in units of 10^-7 degrees. */
export const COORDINATE_SCALE = 1e7;

/** §3.7 Shape deltas are in units of 10^-5 degrees, i.e. 100 coordinate units. */
export const DELTA_UNIT = 100;

/** §3.4, §3.8 Marker for an unknown u16 measurement. */
export const UNKNOWN_U16 = 0xffff;

/** §3.2 Event type codes. Codes are never reused. */
export const EventTypeCode = {
  MEMBER_INFO: 0x01,
  POSITION: 0x02,
  POSITION_HIDDEN: 0x03,
  CHAT: 0x04,
  MARKER: 0x05,
  SHAPE: 0x06,
  OBJECT_DELETE: 0x07,
  SOS: 0x08,
  SOS_CANCEL: 0x09,
  ALERT: 0x0a,
  ACK: 0x0b,
} as const;

/** §3.3 Ed25519 key sizes. */
export const PUBLIC_KEY_SIZE = 32;
export const SECRET_KEY_SIZE = 32;

/** §1 A coordinate pair (lat, lon) on the wire. */
export const POINT_SIZE = 8;

/** §3.3 Alias length in bytes. */
export const ALIAS_MIN_BYTES = 1;
export const ALIAS_MAX_BYTES = 32;

/** §3.7 Shape label length in bytes. */
export const SHAPE_LABEL_MAX_BYTES = 32;

/** §3.7 Shape kind codes. */
export const ShapeKindCode = { POLYLINE: 1, POLYGON: 2, CIRCLE: 3 } as const;

/** §5 Group secret size; also the MeshCore channel key size. */
export const GROUP_SECRET_SIZE = 16;

/** §5 Derived sizes. */
export const GROUP_ID_SIZE = 16;
export const CONTENT_KEY_SIZE = 32;
export const EVENT_KEY_SIZE = 16;
export const EVENT_KEY_MAC_KEY_SIZE = 32;

/** §5 HKDF salt and info strings. */
export const KDF_SALT = 'teselia/v1';
export const KDF_INFO_GROUP_ID = 'group-id';
export const KDF_INFO_CONTENT_KEY = 'content-key';
export const KDF_INFO_EVENT_KEY = 'event-key';

/** §5.1 AES-GCM nonce and tag sizes, and the resulting largest envelope. */
export const ENVELOPE_NONCE_SIZE = 12;
export const ENVELOPE_TAG_SIZE = 16;
export const MAX_ENVELOPE_SIZE = ENVELOPE_NONCE_SIZE + MAX_EVENT_SIZE + ENVELOPE_TAG_SIZE;
/** §5.1 The smallest envelope: an event with an empty payload. */
export const MIN_ENVELOPE_SIZE = ENVELOPE_NONCE_SIZE + HEADER_SIZE + ENVELOPE_TAG_SIZE;

/** §6 Invitation token. */
export const INVITATION_VERSION = 1;
export const GROUP_NAME_MAX_BYTES = 32;
export const SERVER_URL_MAX_BYTES = 200;

/** §8 WebSocket endpoint, relative to the server base URL. */
export const RELAY_PATH = 'v1/ws';

/** §7 MeshCore application identifier, in MeshCore's development range until registered. */
export const MESHCORE_DATA_TYPE = 0xff4d;
