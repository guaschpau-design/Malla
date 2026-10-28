import { describe, expect, it } from 'vitest';
import { gcm } from '@noble/ciphers/aes.js';

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
    expect(toHex(keys.groupId)).toBe('47399e7ce1a62403d2c0c2fe97c98b60');
    expect(toHex(keys.contentKey)).toBe(
      '9715137b9ca8878d3d3f0f2e80de0441c67ffbbe36262c7c32c754abce7309c2',
    );
    expect(toHex(keys.eventKeyMacKey)).toBe(
      'ccf754f08b3da4bbf80eaffe83d2f59f3446651ddfb8b04d27338b6a259629f5',
    );
  });

  it('computes event keys from the spec test vector', () => {
    expect(toHex(eventKey(keys, { origin: ALICE, seq: 1 }))).toBe(
      '9a04f3743bd327c9653a4b0883181451',
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
    const envelope = sealEnvelope(keys, event);
    expect(envelope.length).toBe(MAX_ENVELOPE_SIZE);
    expect(openEnvelope(keys, envelope)).toEqual(event);
  });

  it('seals the same event into the same envelope, and other events with other nonces', () => {
    expect(toHex(sealEnvelope(keys, event))).toBe(toHex(sealEnvelope(keys, event)));
    const other = event.slice();
    other[0] = 0xff;
    const nonce = (envelope: Uint8Array) => toHex(envelope.subarray(0, 12));
    expect(nonce(sealEnvelope(keys, other))).not.toBe(nonce(sealEnvelope(keys, event)));
  });

  it('opens envelopes sealed with a random nonce, as earlier versions did', () => {
    const nonce = seededRandom(1)(12);
    const sealed = gcm(keys.contentKey, nonce, keys.groupId).encrypt(event);
    expect(openEnvelope(keys, Uint8Array.from([...nonce, ...sealed]))).toEqual(event);
  });

  it('refuses a tampered envelope', () => {
    const envelope = sealEnvelope(keys, event);
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

  it('refuses to seal an event larger than the protocol allows', () => {
    const keys = deriveGroupKeys(new Uint8Array(16));
    expect(() => sealEnvelope(keys, new Uint8Array(MAX_EVENT_SIZE + 1))).toThrow(RangeError);
  });
});
