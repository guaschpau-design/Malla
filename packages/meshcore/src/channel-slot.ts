// Choosing the radio channel slot for a group, and naming it (protocol §7).

import type { ChannelInfo } from './companion.ts';

/** MeshCore channel names are 32-byte C strings: at most 31 bytes of UTF-8. */
const CHANNEL_NAME_MAX_BYTES = 31;

export type SlotChoice =
  | { readonly kind: 'reuse'; readonly index: number }
  | { readonly kind: 'empty'; readonly index: number }
  | { readonly kind: 'full' };

/**
 * The slot that already holds the secret, or else the first empty one. A slot is empty when
 * its name is empty and its secret is all zeros, which is how MeshCore clears a channel.
 * Slot 0 is MeshCore's public channel and is never used.
 */
export function chooseChannelSlot(
  channels: readonly ChannelInfo[],
  secret: Uint8Array,
): SlotChoice {
  const candidates = channels.filter((channel) => channel.channelIdx !== 0);
  const existing = candidates.find((channel) => sameBytes(channel.secret, secret));
  if (existing) return { kind: 'reuse', index: existing.channelIdx };
  const empty = candidates.find(
    (channel) => channel.name === '' && channel.secret.every((byte) => byte === 0),
  );
  return empty ? { kind: 'empty', index: empty.channelIdx } : { kind: 'full' };
}

/** The group name cut to 31 bytes of UTF-8 without splitting a character. */
export function channelName(groupName: string): string {
  const encoder = new TextEncoder();
  let name = '';
  for (const char of groupName) {
    if (encoder.encode(name + char).length > CHANNEL_NAME_MAX_BYTES) break;
    name += char;
  }
  return name;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
