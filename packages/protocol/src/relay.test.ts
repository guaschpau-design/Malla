import { describe, expect, it } from 'vitest';

import { toBase64url } from './base64url.ts';
import { MAX_ENVELOPE_SIZE, MIN_ENVELOPE_SIZE } from './constants.ts';
import {
  encodeRelayMessage,
  parseClientMessage,
  parseServerMessage,
  relayUrl,
  type ServerMessage,
} from './relay.ts';

const GROUP = new Uint8Array(16).fill(1);
const KEY = new Uint8Array(16).fill(2);
const ENV = new Uint8Array(60).fill(3);

describe('relay messages', () => {
  it('round-trips every client message', () => {
    for (const message of [
      { t: 'join', group: GROUP, after: 0 },
      { t: 'push', key: KEY, env: ENV },
    ] as const) {
      expect(parseClientMessage(encodeRelayMessage(message))).toEqual({ ok: true, value: message });
    }
  });

  it('round-trips every server message', () => {
    const messages: ServerMessage[] = [
      { t: 'env', cursor: 7, env: ENV },
      { t: 'synced', cursor: 7 },
      { t: 'stored', key: KEY },
      { t: 'error', code: 'rate-limited', key: KEY },
      { t: 'error', code: 'not-joined', key: null },
    ];
    for (const message of messages) {
      expect(parseServerMessage(encodeRelayMessage(message))).toEqual(message);
    }
  });

  it('tells a pusher that its envelope is too large, naming the key', () => {
    const text = JSON.stringify({
      t: 'push',
      key: toBase64url(KEY),
      env: toBase64url(new Uint8Array(MAX_ENVELOPE_SIZE + 1)),
    });
    expect(parseClientMessage(text)).toEqual({ ok: false, error: { code: 'too-large', key: KEY } });
  });

  it('refuses envelopes too small to hold an event', () => {
    const text = JSON.stringify({
      t: 'push',
      key: toBase64url(KEY),
      env: toBase64url(new Uint8Array(MIN_ENVELOPE_SIZE - 1)),
    });
    expect(parseClientMessage(text)).toEqual({
      ok: false,
      error: { code: 'bad-request', key: KEY },
    });
  });

  it.each([
    'not json',
    '[]',
    'null',
    '{"t":"join","group":"AQEBAQEBAQEBAQEBAQEBAQ","after":-1}',
    '{"t":"join","group":"AQEBAQEBAQEBAQEBAQEBAQ","after":1.5}',
    '{"t":"join","group":"short","after":0}',
    '{"t":"push","key":"AgICAgICAgICAgICAgICAg"}',
    '{"t":"subscribe"}',
  ])('answers bad-request to %s', (text) => {
    const result = parseClientMessage(text);
    expect(result.ok ? null : result.error.code).toBe('bad-request');
  });

  it('ignores server frames it does not understand', () => {
    expect(parseServerMessage('{"t":"env","cursor":"7","env":"AA"}')).toBeNull();
    expect(parseServerMessage('{"t":"error","code":"teapot"}')).toBeNull();
    expect(parseServerMessage('{"t":"hello"}')).toBeNull();
  });

  it('derives the WebSocket URL from the server base URL', () => {
    expect(relayUrl('https://teselia.example')).toBe('wss://teselia.example/v1/ws');
    expect(relayUrl('https://example.org/relay/')).toBe('wss://example.org/relay/v1/ws');
    expect(relayUrl('http://localhost:8787')).toBe('ws://localhost:8787/v1/ws');
  });
});
