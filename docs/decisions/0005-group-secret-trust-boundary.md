# 0005. The group secret is the trust boundary; the server is zero-knowledge

- Status: Accepted
- Date: 2026-10-25

## Context

The project must not depend on any authority, including whoever runs a server. Users have no accounts. MeshCore already encrypts each channel with a 16-byte secret. Per-message signatures would let members prove authorship, but an Ed25519 signature is 64 bytes, too much for a 165-byte LoRa packet.

## Decision

- A group is a random 16-byte secret. The same secret is the MeshCore channel key.
- A public group ID, a content key and an event-key function are derived from it with HKDF and HMAC.
- Events sent to a server are encrypted end to end with AES-256-GCM under the content key. The server stores and relays ciphertext and never sees the secret.
- Anyone holding the secret is a full member. Roles are advisory in v0.1.

## Consequences

- Running a server requires no trust: an operator cannot read, forge or alter events.
- A member can impersonate another member. Signatures over the internet link, and key rotation after a leak, are future work, each with its own ADR.
- Losing the secret means losing access; there is no recovery by design.
