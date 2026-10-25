import { ProtocolFailure } from './bytes.ts';
import { NODE_ID_SIZE } from './constants.ts';
import type { EventRef, NodeId } from './events.ts';

const NODE_ID_PATTERN = /^[0-9a-f]{8}$/;

export function isNodeId(value: string): value is NodeId {
  return NODE_ID_PATTERN.test(value);
}

/** Parses a node ID from its hex form, returning null if it is malformed. */
export function parseNodeId(value: string): NodeId | null {
  const normalised = value.toLowerCase();
  return isNodeId(normalised) ? normalised : null;
}

export function nodeIdToBytes(id: NodeId): Uint8Array {
  // The brand is only a compile-time promise; values built with `as` can still be malformed.
  if (!isNodeId(id))
    throw new ProtocolFailure('invalid-value', `malformed node ID "${String(id)}"`);
  const bytes = new Uint8Array(NODE_ID_SIZE);
  for (let i = 0; i < NODE_ID_SIZE; i++) {
    bytes[i] = Number.parseInt(id.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function nodeIdFromBytes(bytes: Uint8Array): NodeId {
  if (bytes.length !== NODE_ID_SIZE) {
    throw new RangeError(`a node ID is ${NODE_ID_SIZE} bytes, got ${bytes.length}`);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('') as NodeId;
}

/** A stable string key for maps and sets, e.g. "a1b2c3d4:17". */
export function eventRefKey(ref: EventRef): string {
  return `${ref.origin}:${ref.seq}`;
}
