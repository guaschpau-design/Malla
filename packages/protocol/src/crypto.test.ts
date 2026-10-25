import { describe, expect, it } from 'vitest';

import { MAX_ENVELOPE_SIZE, MAX_EVENT_SIZE } from './constants.ts';
import {
  deriveGroupKeys,
  eventKey,
  generateIdentity,
  nodeIdFromPublicKey,
  openEnvelope,
  sealEnvelope,
} from './crypto.ts';
import { ALICE, seededRandom, toHex } from './test-helpers.ts';

// Expected values below were computed with an independent Python implementation of the spec.
const SECRET = Uint8Array.from({ length: 16 }, (_, i) => i);

describe('identity', () => {
  it('derives the node ID from the public key as the spec defines', () => {
    expect(nodeIdFromPublicKey(Uint8Array.from({ length: 32 }, (_, i) => i))).toBe('630dcd29');
  });

  it('generates an identity whose node ID matches its public key', () => {
    const identity = generateIdentity(seededRandom(7));
    expect(identity.publicKey.length).toBe(32);
    expect(identity.nodeId).toBe(nodeIdFromPublicKey(identity.publicKey));
  });
});

describe('group keys', () => {
  const keys = deriveGroupKeys(SECRET);

  it('derives the group ID, content key and event-key MAC key from the spec test vector', () => {
    expect(toHex(keys.groupId)).toBe('56d82484aa9361a73f110b487b2a3bbc');
    expect(toHex(keys.contentKey)).toBe(
      '14f1bee34e4893d3da95692379b7feb58951f059445f2d4e5f972c839c1810e4',
    );
    expect(toHex(keys.eventKeyMacKey)).toBe(
      '3e793c7969f0e5e8e12bab2fe12fcb93c2e13251e39d5e0a440b5e1612559a61',
    );
  });

  it('computes event keys from the spec test vector', () => {
    expect(toHex(eventKey(keys, { origin: ALICE, seq: 1 }))).toBe(
      '50cc4a0f2d7d3e86694f29fd07e0e33b',
    );
  });

  it('gives different event keys to different events', () => {
    const a = toHex(eventKey(keys, { origin: ALICE, seq: 1 }));
    const b = toHex(eventKey(keys, { origin: ALICE, seq: 2 }));
    expect(a).not.toBe(b);
  });

  it('rejects a secret of the wrong size', () => {
    expect(() => deriveGroupKeys(new Uint8Array(15))).toThrow(RangeError);
  });
});

describe('envelopes', () => {
  const keys = deriveGroupKeys(SECRET);
  const event = Uint8Array.from({ length: MAX_EVENT_SIZE }, (_, i) => i & 0xff);

  it('round-trips an event and stays within the size limit', () => {
    const envelope = sealEnvelope(keys, event, seededRandom(1));
    expect(envelope.length).toBe(MAX_ENVELOPE_SIZE);
    expect(openEnvelope(keys, envelope)).toEqual(event);
  });

  it('uses a fresh nonce for every envelope', () => {
    const first = sealEnvelope(keys, event);
    const second = sealEnvelope(keys, event);
    expect(toHex(first)).not.toBe(toHex(second));
  });

  it('refuses a tampered envelope', () => {
    const envelope = sealEnvelope(keys, event, seededRandom(1));
    envelope[20] = (envelope[20] ?? 0) ^ 1;
    expect(openEnvelope(keys, envelope)).toBeNull();
  });

  it('refuses an envelope sealed for another group', () => {
    const other = deriveGroupKeys(new Uint8Array(16).fill(9));
    expect(openEnvelope(other, sealEnvelope(keys, event))).toBeNull();
  });

  it('refuses envelopes that are too short or too long', () => {
    expect(openEnvelope(keys, new Uint8Array(10))).toBeNull();
    expect(openEnvelope(keys, new Uint8Array(MAX_ENVELOPE_SIZE + 1))).toBeNull();
  });
});
