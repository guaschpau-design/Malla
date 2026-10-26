// Encoded events as the radio scheduler sees them (packages/core lora-scheduler): decoded when
// this version knows their type, or only their header otherwise, so they can still be bridged.

import type { LoraEvent } from '@tesel/core';
import { decodeEvent, peekHeader, type EventType } from '@tesel/protocol';

/** An encoded event as the radio sees it: decoded, or only its header if its type is unknown. */
export function loraEventOf(bytes: Uint8Array): LoraEvent | null {
  const event = decodeEvent(bytes);
  if (event.ok) return event.value;
  const header = peekHeader(bytes);
  if (!header.ok) return null;
  const { origin, seq, time } = header.value;
  return { type: null, origin, seq, time };
}

/** The type of an encoded event, or null if this version does not know it. */
export function peekType(bytes: Uint8Array): EventType | null {
  return loraEventOf(bytes)?.type ?? null;
}
