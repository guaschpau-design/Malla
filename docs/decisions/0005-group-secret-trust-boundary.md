# 0005. The group secret is the trust boundary; the server is zero-knowledge

- Status: Accepted, amended by [0052](0052-authorship-is-not-proven.md) (authorship is not proven in protocol version 1)
- Date: 2026-10-25

## Context

The project must not depend on any authority, including whoever runs a server. Users have no accounts. MeshCore already encrypts each channel with a 16-byte secret. Per-message signatures would let members prove authorship, but an Ed25519 signature is 64 bytes, too much for a 165-byte LoRa packet.

## Decision

- A group is a random 16-byte secret. The same secret is the MeshCore channel key.
- A public group ID, a content key and an event-key function are derived from it with HKDF and HMAC.
- Events sent to a server are encrypted end to end with AES-256-GCM under the content key. The server stores and relays ciphertext and never sees the secret.
- Anyone holding the secret is a full member. Roles are advisory in v0.1.

## Consequences

- An operator who only relays envelopes cannot read, forge or alter events. Whoever serves the app's code to a device is trusted all the same, as with any web app: a server that served a changed app could read the groups of everyone who loads it. The servers Tesel installs run only images signed by the project's CI ([ADR-0049](0049-signed-images-and-checked-updates.md)), and a group can use one server for its envelopes and load the app from another; a device that installed the app keeps running the version it has until its user accepts an update.
- A member can impersonate another member; [ADR-0052](0052-authorship-is-not-proven.md) decides that protocol version 1 stays so. Key rotation after a leak is future work.
- Losing the secret means losing access; there is no recovery by design.
