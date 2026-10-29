# 0067. Derive each envelope's nonce from its event

- Status: Accepted
- Date: 2026-10-29

## Context

An envelope was sealed with a random 12-byte nonce (protocol §5.1). Since the server keeps every distinct envelope pushed under a key ([ADR-0045](0045-server-keeps-every-distinct-envelope.md)), one event sealed twice became two envelopes: a retry that sealed anew, several bridges forwarding what they heard by radio, a client pushing its events again after a store change ([ADR-0046](0046-store-identity.md)). Each was stored and relayed once more. Receivers' event logs ignored the repeats, but storage and traffic grew with every one. ADR-0045 named sealing deterministically as its follow-up. The change was made in the protocol on 2026-10-28, before version 1 was frozen; this record states it.

## Decision

- A group has one more derived secret, the **nonce key**: `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "nonce-key")`, 32 bytes.
- An envelope's nonce is `HMAC-SHA256(nonceKey, event)`, truncated to 12 bytes (protocol §5.1; `packages/protocol/src/crypto.ts`). The same event always seals into the same envelope, so a repeat is answered `stored` and not kept or relayed again.
- Receivers do not check how a nonce was made: envelopes sealed earlier, with random nonces, open as before.

This amends [ADR-0045](0045-server-keeps-every-distinct-envelope.md).

## Consequences

- Retries, re-pushes and bridges cost the server nothing once it has an event.
- AES-GCM fails badly when one nonce seals two different messages under one key. A nonce from a keyed hash of the whole event repeats only for the same event, or by chance with the odds of a random nonce: a group should stay well below 2³² distinct events under one secret, as with random nonces.
- An envelope shows that it carries the same event as another envelope, which its event key already shows.
- Deduplication works for senders that seal so: a client that still seals with random nonces costs a stored envelope per sealing, as before.
