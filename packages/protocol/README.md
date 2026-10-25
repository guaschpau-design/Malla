# @teselia/protocol

The single implementation of [`docs/protocol.md`](../../docs/protocol.md): event encoding and decoding, group key derivation, internet envelopes and invitation links.

Pure TypeScript. No DOM, no Node APIs, no network. Runs unchanged in the browser, in Node and in tests.

| File            | Spec section                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| `constants.ts`  | All numeric constants                                                            |
| `result.ts`     | Result type and error codes returned by every decoder                            |
| `bytes.ts`      | §1 conventions: little-endian reader and writer, UTF-8                           |
| `node-id.ts`    | §1 node IDs and event references                                                 |
| `base64url.ts`  | §1 base64url                                                                     |
| `events.ts`     | §3 event types as TypeScript types                                               |
| `codec.ts`      | §3 encoding, decoding and header peeking                                         |
| `fields.ts`     | §3 payload fields: references, texts, measurements, enumerations, shape geometry |
| `geometry.ts`   | §1, §3.7 coordinates and delta-encoded point lists                               |
| `crypto.ts`     | §1, §5 identity, key derivation, envelopes                                       |
| `invitation.ts` | §6 invitation links                                                              |

To inspect an encoded event:

```sh
pnpm --filter @teselia/protocol decode 0104a1b2c3d4010000000013fc68486f6c61
```
