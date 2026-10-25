// Messages of the internet transport (docs/protocol.md §8): JSON text frames over a WebSocket,
// shared by the server and the clients so both sides validate them the same way.

import { fromBase64url, toBase64url } from './base64url.ts';
import {
  EVENT_KEY_SIZE,
  GROUP_ID_SIZE,
  MAX_ENVELOPE_SIZE,
  MIN_ENVELOPE_SIZE,
  RELAY_PATH,
} from './constants.ts';
import { err, ok, type Result } from './result.ts';

export type ClientMessage =
  | { readonly t: 'join'; readonly group: Uint8Array; readonly after: number }
  | { readonly t: 'push'; readonly key: Uint8Array; readonly env: Uint8Array };

export type RelayErrorCode = 'bad-request' | 'too-large' | 'rate-limited' | 'not-joined';

export type ServerMessage =
  | { readonly t: 'env'; readonly cursor: number; readonly env: Uint8Array }
  | { readonly t: 'synced'; readonly cursor: number }
  | { readonly t: 'stored'; readonly key: Uint8Array }
  | { readonly t: 'error'; readonly code: RelayErrorCode; readonly key: Uint8Array | null };

/** Why a client message was refused; `key` is set when the message was a push. */
export interface RelayRefusal {
  readonly code: 'bad-request' | 'too-large';
  readonly key: Uint8Array | null;
}

/** §8 The WebSocket URL of a server: `https://host/` becomes `wss://host/v1/ws`. */
export function relayUrl(serverBaseUrl: string): string {
  const url = new URL(
    RELAY_PATH,
    serverBaseUrl.endsWith('/') ? serverBaseUrl : `${serverBaseUrl}/`,
  );
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return url.href;
}

export function encodeRelayMessage(message: ClientMessage | ServerMessage): string {
  switch (message.t) {
    case 'join':
      return JSON.stringify({ t: 'join', group: toBase64url(message.group), after: message.after });
    case 'push':
      return JSON.stringify({
        t: 'push',
        key: toBase64url(message.key),
        env: toBase64url(message.env),
      });
    case 'env':
      return JSON.stringify({ t: 'env', cursor: message.cursor, env: toBase64url(message.env) });
    case 'synced':
      return JSON.stringify({ t: 'synced', cursor: message.cursor });
    case 'stored':
      return JSON.stringify({ t: 'stored', key: toBase64url(message.key) });
    case 'error':
      return JSON.stringify(
        message.key === null
          ? { t: 'error', code: message.code }
          : { t: 'error', code: message.code, key: toBase64url(message.key) },
      );
  }
}

/** Parses a frame received by the server. Never throws. */
export function parseClientMessage(text: string): Result<ClientMessage, RelayRefusal> {
  const badRequest = err<RelayRefusal>({ code: 'bad-request', key: null });
  const object = parseObject(text);
  if (object === null) return badRequest;
  switch (object['t']) {
    case 'join': {
      const group = bytesField(object, 'group');
      const after = object['after'];
      if (group?.length !== GROUP_ID_SIZE || !isCursor(after)) return badRequest;
      return ok({ t: 'join', group, after });
    }
    case 'push': {
      const key = bytesField(object, 'key');
      if (key?.length !== EVENT_KEY_SIZE) return badRequest;
      const env = bytesField(object, 'env');
      if (env === null) return err({ code: 'bad-request', key });
      if (env.length > MAX_ENVELOPE_SIZE) return err({ code: 'too-large', key });
      if (env.length < MIN_ENVELOPE_SIZE) return err({ code: 'bad-request', key });
      return ok({ t: 'push', key, env });
    }
    default:
      return badRequest;
  }
}

/** Parses a frame received by a client, or returns null if it is not a valid message. */
export function parseServerMessage(text: string): ServerMessage | null {
  const object = parseObject(text);
  if (object === null) return null;
  switch (object['t']) {
    case 'env': {
      const cursor = object['cursor'];
      const env = bytesField(object, 'env');
      return isCursor(cursor) && env !== null ? { t: 'env', cursor, env } : null;
    }
    case 'synced': {
      const cursor = object['cursor'];
      return isCursor(cursor) ? { t: 'synced', cursor } : null;
    }
    case 'stored': {
      const key = bytesField(object, 'key');
      return key?.length === EVENT_KEY_SIZE ? { t: 'stored', key } : null;
    }
    case 'error': {
      const code = object['code'];
      if (!isRelayErrorCode(code)) return null;
      return { t: 'error', code, key: bytesField(object, 'key') };
    }
    default:
      return null;
  }
}

const RELAY_ERROR_CODES: ReadonlySet<unknown> = new Set<RelayErrorCode>([
  'bad-request',
  'too-large',
  'rate-limited',
  'not-joined',
]);

function isRelayErrorCode(value: unknown): value is RelayErrorCode {
  return RELAY_ERROR_CODES.has(value);
}

/** A cursor is a non-negative integer that JSON and JavaScript represent exactly. */
function isCursor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseObject(text: string): Readonly<Record<string, unknown>> | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function bytesField(object: Readonly<Record<string, unknown>>, name: string): Uint8Array | null {
  const value = object[name];
  return typeof value === 'string' ? fromBase64url(value) : null;
}
