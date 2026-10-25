// Identity, group key derivation and internet envelopes (docs/protocol.md §1, §3.3, §5).

import { gcm } from '@noble/ciphers/aes.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

import { ByteWriter, encodeUtf8 } from './bytes.ts';
import {
  CONTENT_KEY_SIZE,
  ENVELOPE_NONCE_SIZE,
  ENVELOPE_TAG_SIZE,
  EVENT_KEY_MAC_KEY_SIZE,
  EVENT_KEY_SIZE,
  GROUP_ID_SIZE,
  GROUP_SECRET_SIZE,
  KDF_INFO_CONTENT_KEY,
  KDF_INFO_EVENT_KEY,
  KDF_INFO_GROUP_ID,
  KDF_SALT,
  MAX_ENVELOPE_SIZE,
  MAX_EVENT_SIZE,
  NODE_ID_SIZE,
  PUBLIC_KEY_SIZE,
  SECRET_KEY_SIZE,
} from './constants.ts';
import type { EventRef, NodeId } from './events.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';

/** Source of cryptographically secure random bytes; injectable so tests are deterministic. */
export type RandomSource = (length: number) => Uint8Array;

const secureRandom: RandomSource = (length) => randomBytes(length);

// --- Identity ----------------------------------------------------------------------------

export interface Identity {
  readonly nodeId: NodeId;
  readonly publicKey: Uint8Array;
  /** Never leaves the device. */
  readonly secretKey: Uint8Array;
}

export function generateIdentity(random: RandomSource = secureRandom): Identity {
  const secretKey = random(SECRET_KEY_SIZE);
  const publicKey = ed25519.getPublicKey(secretKey);
  return { nodeId: nodeIdFromPublicKey(publicKey), publicKey, secretKey };
}

/** §1 The node ID is the first 4 bytes of SHA-256 of the Ed25519 public key. */
export function nodeIdFromPublicKey(publicKey: Uint8Array): NodeId {
  if (publicKey.length !== PUBLIC_KEY_SIZE) {
    throw new RangeError(`an Ed25519 public key is ${PUBLIC_KEY_SIZE} bytes`);
  }
  return nodeIdFromBytes(sha256(publicKey).slice(0, NODE_ID_SIZE));
}

// --- Group keys --------------------------------------------------------------------------

export interface GroupKeys {
  /** The group secret itself; also the MeshCore channel key. */
  readonly secret: Uint8Array;
  /** Public routing identifier for servers. */
  readonly groupId: Uint8Array;
  readonly contentKey: Uint8Array;
  readonly eventKeyMacKey: Uint8Array;
}

export function generateGroupSecret(random: RandomSource = secureRandom): Uint8Array {
  return random(GROUP_SECRET_SIZE);
}

/** §5 Derives every group value from the 16-byte secret. */
export function deriveGroupKeys(secret: Uint8Array): GroupKeys {
  if (secret.length !== GROUP_SECRET_SIZE) {
    throw new RangeError(`a group secret is ${GROUP_SECRET_SIZE} bytes`);
  }
  const salt = encodeUtf8(KDF_SALT);
  const derive = (info: string, length: number): Uint8Array =>
    hkdf(sha256, secret, salt, encodeUtf8(info), length);
  return {
    secret: secret.slice(),
    groupId: derive(KDF_INFO_GROUP_ID, GROUP_ID_SIZE),
    contentKey: derive(KDF_INFO_CONTENT_KEY, CONTENT_KEY_SIZE),
    eventKeyMacKey: derive(KDF_INFO_EVENT_KEY, EVENT_KEY_MAC_KEY_SIZE),
  };
}

/** §5 Opaque de-duplication key the server stores alongside an envelope. */
export function eventKey(keys: GroupKeys, ref: EventRef): Uint8Array {
  const message = new ByteWriter().raw(nodeIdToBytes(ref.origin)).u32(ref.seq).toBytes();
  return hmac(sha256, keys.eventKeyMacKey, message).slice(0, EVENT_KEY_SIZE);
}

// --- Envelopes ---------------------------------------------------------------------------

/**
 * §5.1 Encrypts an encoded event for the internet transport. Nonces are random, so a group
 * should stay well below 2^32 envelopes under one secret; key rotation is future work.
 */
export function sealEnvelope(
  keys: GroupKeys,
  event: Uint8Array,
  random: RandomSource = secureRandom,
): Uint8Array {
  if (event.length > MAX_EVENT_SIZE) {
    throw new RangeError(`events are at most ${MAX_EVENT_SIZE} bytes; encode with encodeEvent`);
  }
  const nonce = random(ENVELOPE_NONCE_SIZE);
  const ciphertext = gcm(keys.contentKey, nonce, keys.groupId).encrypt(event);
  const envelope = new Uint8Array(nonce.length + ciphertext.length);
  envelope.set(nonce, 0);
  envelope.set(ciphertext, nonce.length);
  return envelope;
}

/** §5.1 Decrypts an envelope; returns null if it is malformed or was not sealed with these keys. */
export function openEnvelope(keys: GroupKeys, envelope: Uint8Array): Uint8Array | null {
  if (
    envelope.length > MAX_ENVELOPE_SIZE ||
    envelope.length < ENVELOPE_NONCE_SIZE + ENVELOPE_TAG_SIZE
  ) {
    return null;
  }
  const nonce = envelope.subarray(0, ENVELOPE_NONCE_SIZE);
  const ciphertext = envelope.subarray(ENVELOPE_NONCE_SIZE);
  try {
    return gcm(keys.contentKey, nonce, keys.groupId).decrypt(ciphertext);
  } catch {
    return null;
  }
}
