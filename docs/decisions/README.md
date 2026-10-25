# Architecture decision records

Each file records one decision: the context, what we chose and what follows from it. Records are never edited after acceptance except to mark them superseded; a changed decision gets a new record.

Template: copy [`template.md`](template.md), use the next number, keep it under a page.

| #                                                  | Decision                                                                 | Status                        |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------- |
| [0001](0001-record-decisions-and-language.md)      | Record decisions as ADRs; English for code and technical docs            | Accepted                      |
| [0002](0002-pwa-only-client.md)                    | A progressive web app is the only client in v0.1                         | Superseded after v0.1 by 0016 |
| [0003](0003-event-log-last-writer-wins.md)         | Event log with last-writer-wins instead of a CRDT library                | Accepted                      |
| [0004](0004-one-binary-format-every-transport.md)  | One binary event format for every transport                              | Accepted                      |
| [0005](0005-group-secret-trust-boundary.md)        | The group secret is the trust boundary; the server is zero-knowledge     | Accepted                      |
| [0006](0006-meshcore-first-channel-datagrams.md)   | MeshCore first, through channel data datagrams                           | Accepted                      |
| [0007](0007-self-hosted-vector-maps.md)            | Self-hosted vector maps for offline use                                  | Partly superseded by 0011     |
| [0008](0008-one-server-vps-and-command-post.md)    | One server program for the VPS and the local command post                | Accepted                      |
| [0009](0009-toolchain.md)                          | Toolchain: TypeScript, pnpm workspace, Svelte, Vitest                    | Accepted                      |
| [0010](0010-lora-link-security.md)                 | Rely on MeshCore channel encryption for LoRa in v0.1, knowing its limits | Accepted                      |
| [0011](0011-client-side-area-download.md)          | Download offline areas tile by tile in the browser                       | Accepted                      |
| [0012](0012-invitation-links-under-a-base-path.md) | Invitation links work under a base path                                  | Accepted, amended by 0017     |
| [0013](0013-self-updating-vps.md)                  | A self-updating VPS behind Caddy, installed by one script                | Accepted                      |
| [0014](0014-name-teselia.md)                       | The project is called Teselia                                            | Accepted                      |
| [0015](0015-lora-airtime-policy.md)                | LoRa airtime policy                                                      | Accepted                      |
| [0016](0016-web-app-and-native-shells.md)          | The web app first, and Android and iOS apps built from the same code     | Accepted                      |
| [0017](0017-server-serves-site-and-app.md)         | The server serves the landing page and the web app                       | Accepted                      |
