# @malla/protocol

The single implementation of [`docs/protocol.md`](../../docs/protocol.md): event encoding and decoding, group key derivation, internet envelopes and invitation links.

Pure TypeScript. No DOM, no Node APIs, no network. Runs unchanged in the browser, in Node and in tests.

| File            | Spec section                                     |
| --------------- | ------------------------------------------------ |
| `constants.ts`  | All numeric constants                            |
| `bytes.ts`      | §1 conventions (little-endian reader and writer) |
| `events.ts`     | §3 event types as TypeScript types               |
| `codec.ts`      | §3 encoding and decoding                         |
| `geometry.ts`   | §3.7 delta-encoded point lists                   |
| `crypto.ts`     | §5 key derivation and envelopes, node IDs        |
| `invitation.ts` | §6 invitation links                              |
