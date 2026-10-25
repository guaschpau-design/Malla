// Regression tests for findings of the day-0 independent review.

import { describe, expect, it } from 'vitest';

import { fromBase64url, toBase64url } from './base64url.ts';
import { decodeEvent, encodeEvent, peekHeader } from './codec.ts';
import { MAX_EVENT_SIZE } from './constants.ts';
import { deriveGroupKeys, sealEnvelope } from './crypto.ts';
import type { MallaEvent, NodeId, ShapeEvent } from './events.ts';
import { decodeInvitationToken, encodeInvitationToken, parseInvitationUrl } from './invitation.ts';
import { ALICE, CAROL, T0 } from './test-helpers.ts';

function encodeOrFail(event: MallaEvent): Uint8Array {
  const result = encodeEvent(event);
  if (!result.ok) throw new Error(`encoding failed: ${result.error.detail}`);
  return result.value;
}

const polygonAt = (points: ShapeEvent['geometry']): ShapeEvent => ({
  type: 'shape',
  origin: ALICE,
  seq: 1,
  time: T0,
  object: { origin: ALICE, seq: 1 },
  style: 0,
  label: '',
  geometry: points,
});

describe('text fields', () => {
  it('keeps a leading byte-order mark instead of silently dropping it', () => {
    const event: MallaEvent = { type: 'chat', origin: ALICE, seq: 1, time: T0, text: '﻿hi' };
    expect(decodeEvent(encodeOrFail(event))).toEqual({ ok: true, value: event });
  });
});

describe('polygon closure', () => {
  const almostClosed = polygonAt({
    kind: 'polygon',
    points: [
      { lat: 10, lon: 10 },
      { lat: 10.01, lon: 10 },
      { lat: 10.000001, lon: 10.000001 },
    ],
  });

  it('refuses a polygon whose last point rounds onto the first', () => {
    expect(encodeEvent(almostClosed).ok).toBe(false);
  });

  it('rejects such a polygon when decoding', () => {
    const triangle = encodeOrFail(
      polygonAt({
        kind: 'polygon',
        points: [
          { lat: 10, lon: 10 },
          { lat: 10.01, lon: 10 },
          { lat: 10, lon: 10.01 },
        ],
      }),
    );
    // Rewrite the last delta so the reconstructed last point equals the first.
    const view = new DataView(triangle.buffer);
    const lastDelta = triangle.length - 4;
    view.setInt16(lastDelta, -1000, true);
    view.setInt16(lastDelta + 2, 0, true);
    expect(decodeEvent(triangle).ok).toBe(false);
  });

  it('keeps reconstructed points inside the valid range near the pole', () => {
    const line = polygonAt({
      kind: 'polyline',
      points: [
        { lat: 89.99, lon: 0 },
        { lat: 89.999999999, lon: 0.000006 },
      ],
    });
    const decoded = decodeEvent(encodeOrFail(line));
    expect(decoded.ok).toBe(true);
  });
});

describe('member info', () => {
  const publicKey = Uint8Array.from({ length: 32 }, (_, i) => i);
  const member: MallaEvent = {
    type: 'member-info',
    origin: CAROL,
    seq: 1,
    time: T0,
    role: 'member',
    publicKey,
    alias: 'Carol',
  };

  it('refuses to encode a public key that does not match the origin', () => {
    expect(encodeEvent({ ...member, origin: ALICE }).ok).toBe(false);
  });

  it('rejects a received public key that does not match the origin', () => {
    const bytes = encodeOrFail(member);
    bytes[2] = 0x00; // change the origin
    expect(decodeEvent(bytes).ok).toBe(false);
  });

  it('reads a reserved role as member', () => {
    const bytes = encodeOrFail(member);
    bytes[14] = 9;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'member-info' && decoded.value.role).toBe('member');
  });
});

describe('reserved values and unknown types', () => {
  it('reads a reserved alert level as warning', () => {
    const bytes = encodeOrFail({
      type: 'alert',
      origin: ALICE,
      seq: 1,
      time: T0,
      level: 'info',
      text: 'x',
    });
    bytes[14] = 7;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'alert' && decoded.value.level).toBe('warning');
  });

  it('exposes the header of an unknown event type so bridges can forward it', () => {
    const bytes = encodeOrFail({ type: 'chat', origin: ALICE, seq: 42, time: T0, text: 'hi' });
    bytes[1] = 0x7f;
    expect(decodeEvent(bytes).ok).toBe(false);
    expect(peekHeader(bytes)).toEqual({
      ok: true,
      value: { typeCode: 0x7f, origin: ALICE, seq: 42, time: T0 },
    });
  });
});

describe('input validation', () => {
  it('refuses a malformed node ID instead of encoding zeros', () => {
    const event: MallaEvent = {
      type: 'position-hidden',
      origin: 'zz' as NodeId,
      seq: 1,
      time: T0,
    };
    expect(encodeEvent(event).ok).toBe(false);
  });

  it('refuses to seal an event larger than the protocol allows', () => {
    const keys = deriveGroupKeys(new Uint8Array(16));
    expect(() => sealEnvelope(keys, new Uint8Array(MAX_EVENT_SIZE + 1))).toThrow(RangeError);
  });
});

describe('invitation links', () => {
  const invitation = {
    role: 'member',
    secret: new Uint8Array(16).fill(3),
    issuer: ALICE,
    groupName: 'Grupo',
    server: null,
  } as const;
  const token = encodeInvitationToken(invitation);
  const tokenText = token.ok ? token.value : '';

  it('accepts only https links whose last path segment is join', () => {
    expect(parseInvitationUrl(`https://app.example/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`https://app.example/malla/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`http://app.example/join#${tokenText}`).ok).toBe(false);
    expect(parseInvitationUrl(`https://app.example/xjoin#${tokenText}`).ok).toBe(false);
    expect(parseInvitationUrl(`https://app.example/join/#${tokenText}`).ok).toBe(false);
    expect(parseInvitationUrl(`https://app.example/join?x=1#${tokenText}`).ok).toBe(false);
  });

  it('accepts plain http only on a loopback host, for development', () => {
    expect(parseInvitationUrl(`http://localhost:5173/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`http://127.0.0.1/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`http://localhost.example/join#${tokenText}`).ok).toBe(false);
    expect(encodeInvitationToken({ ...invitation, server: 'http://localhost:8080' }).ok).toBe(true);
    expect(encodeInvitationToken({ ...invitation, server: 'http://192.168.1.10' }).ok).toBe(false);
  });

  it('refuses a server value that only looks like an https URL', () => {
    expect(encodeInvitationToken({ ...invitation, server: 'https://' }).ok).toBe(false);
  });

  it('grants member when the role byte is reserved', () => {
    const bytes = fromBase64url(tokenText) ?? new Uint8Array();
    bytes[1] = 9; // role byte
    const decoded = decodeInvitationToken(toBase64url(bytes));
    expect(decoded.ok && decoded.value.role).toBe('member');
  });
});
