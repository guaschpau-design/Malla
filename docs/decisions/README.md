# Architecture decision records

Each file records one decision: the context, what we chose and what follows from it. Records are never edited after acceptance except to mark them superseded; a changed decision gets a new record.

Template: copy [`template.md`](template.md), use the next number, keep it under a page.

| #                                                 | Decision                                                                 | Status   |
| ------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| [0001](0001-record-decisions-and-language.md)     | Record decisions as ADRs; English for code and technical docs            | Accepted |
| [0002](0002-pwa-only-client.md)                   | A progressive web app is the only client in v0.1                         | Accepted |
| [0003](0003-event-log-last-writer-wins.md)        | Event log with last-writer-wins instead of a CRDT library                | Accepted |
| [0004](0004-one-binary-format-every-transport.md) | One binary event format for every transport                              | Accepted |
| [0005](0005-group-secret-trust-boundary.md)       | The group secret is the trust boundary; the server is zero-knowledge     | Accepted |
| [0006](0006-meshcore-first-channel-datagrams.md)  | MeshCore first, through channel data datagrams                           | Accepted |
| [0007](0007-self-hosted-vector-maps.md)           | Self-hosted vector maps for offline use                                  | Accepted |
| [0008](0008-one-server-vps-and-command-post.md)   | One server program for the VPS and the local command post                | Accepted |
| [0009](0009-toolchain.md)                         | Toolchain: TypeScript, pnpm workspace, Svelte, Vitest                    | Accepted |
| [0010](0010-lora-link-security.md)                | Rely on MeshCore channel encryption for LoRa in v0.1, knowing its limits | Accepted |
