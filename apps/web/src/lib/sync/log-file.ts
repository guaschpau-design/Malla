// A group's log saved to a file and loaded on another device (protocol §10): the events sealed
// with the group's key, so the file reads only for its members.

import {
  bytesEqual,
  encodeLogFile,
  openEnvelope,
  parseLogFile,
  sealEnvelope,
  type GroupKeys,
} from '@tesel/protocol';

/** What loading a log file did. */
export type LogImport =
  | { readonly kind: 'loaded'; readonly added: number; readonly total: number }
  | { readonly kind: 'other-group' }
  | { readonly kind: 'unreadable' };

/** A log file of the group's events. */
export function sealLogFile(keys: GroupKeys, events: readonly Uint8Array[]): string {
  const envelopes = events.map((bytes) => sealEnvelope(keys, bytes));
  return encodeLogFile({ groupId: keys.groupId, envelopes });
}

/**
 * The events of a log file of this group, leaving out envelopes not sealed with its key; or why
 * the file cannot be loaded.
 */
export function openLogFile(
  keys: GroupKeys,
  text: string,
): Uint8Array[] | Exclude<LogImport, { kind: 'loaded' }> {
  const file = parseLogFile(text);
  if (!file.ok) return { kind: 'unreadable' };
  if (!bytesEqual(file.value.groupId, keys.groupId)) return { kind: 'other-group' };
  return file.value.envelopes.flatMap((env) => openEnvelope(keys, env) ?? []);
}
