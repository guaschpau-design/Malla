# 0004. One binary event format for every transport

- Status: Accepted
- Date: 2026-10-25

## Context

Events travel over LoRa, over the internet and through bridges that move them between the two. Using JSON on the internet and a compact format on LoRa would mean two codecs to keep in sync and a translation step in every bridge, where bugs hide.

## Decision

Events have exactly one encoding: the compact binary format in `docs/protocol.md`. The same bytes are sent as a MeshCore datagram and, encrypted, inside an internet envelope. Bridges forward bytes without re-encoding.

## Consequences

- One codec, tested once, used everywhere.
- Every event, on every transport, is limited to the LoRa size budget. Larger content (photos) will need a separate mechanism later.
- Debugging needs a decoder tool rather than reading JSON; we provide one in `packages/protocol`.
