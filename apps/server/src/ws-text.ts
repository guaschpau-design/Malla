// WebSocket frames of the relay protocol (docs/protocol.md §8): their size limit, and their text
// as the ws library delivers it.

import type WebSocket from 'ws';

/** Largest frame either side accepts: the largest message, an envelope, is about 330 bytes. */
export const MAX_FRAME_BYTES = 1024;

export function frameText(data: WebSocket.RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data).toString('utf8');
}
