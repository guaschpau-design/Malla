# @teselia/meshcore

Connects Teselia to a MeshCore companion radio (firmware v1.18 or later, Companion BLE build) and exchanges events as channel data datagrams, as specified in [`docs/protocol.md`](../../docs/protocol.md) §7 and decided in [ADR-0006](../../docs/decisions/0006-meshcore-first-channel-datagrams.md).

The rest of the code depends only on the `RadioLink` interface in `src/radio-link.ts`. The implementation, built on the MIT-licensed `@liamcottle/meshcore.js`, arrives on day 5; keeping it behind this interface means the library can be replaced without touching anything else.
