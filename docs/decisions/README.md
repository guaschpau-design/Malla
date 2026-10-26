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
| [0008](0008-one-server-vps-and-command-post.md)    | One server program for the VPS and the local command post                | Accepted, settled by 0018     |
| [0009](0009-toolchain.md)                          | Toolchain: TypeScript, pnpm workspace, Svelte, Vitest                    | Accepted                      |
| [0010](0010-lora-link-security.md)                 | Rely on MeshCore channel encryption for LoRa in v0.1, knowing its limits | Accepted                      |
| [0011](0011-client-side-area-download.md)          | Download offline areas tile by tile in the browser                       | Accepted                      |
| [0012](0012-invitation-links-under-a-base-path.md) | Invitation links work under a base path                                  | Accepted, amended by 0017     |
| [0013](0013-self-updating-vps.md)                  | A self-updating VPS behind Caddy, installed by one script                | Accepted                      |
| [0014](0014-name-teselia.md)                       | The project is called Teselia                                            | Superseded by 0019            |
| [0015](0015-lora-airtime-policy.md)                | LoRa airtime policy                                                      | Accepted                      |
| [0016](0016-web-app-and-native-shells.md)          | The web app first, and Android and iOS apps built from the same code     | Accepted                      |
| [0017](0017-server-serves-site-and-app.md)         | The server serves the landing page and the web app                       | Accepted                      |
| [0018](0018-command-post.md)                       | A command post is a replicating server on its own Wi-Fi, found by name   | Accepted                      |
| [0019](0019-name-tesel.md)                         | The project is called Tesel                                              | Accepted                      |
| [0020](0020-colour-and-symbols.md)                 | Signal lime, colours defined once, and symbols of our own                | Accepted                      |
| [0021](0021-coordinate-formats.md)                 | Write coordinates in four formats, converted by our own code             | Accepted                      |
| [0022](0022-log-files.md)                          | Carry a group's log in files of sealed envelopes                         | Accepted                      |
| [0023](0023-ign-base-maps.md)                      | Topographic and aerial base maps from Spain's IGN, read by the browser   | Accepted                      |
| [0024](0024-terrain-tiles-for-relief.md)           | Relief from the open Terrain Tiles, read by the browser                  | Accepted                      |
| [0025](0025-tasks.md)                              | Tasks as one event type, changed by anyone, last writer wins             | Accepted                      |
| [0026](0026-one-kind-of-alert.md)                  | The app sends one kind of alert                                          | Accepted                      |
| [0027](0027-public-services-from-the-base-map.md)  | Public services from the base map                                        | Accepted                      |
| [0028](0028-roll-call.md)                          | Roll call: one event, answered with an ACK by each member                | Accepted                      |
| [0029](0029-operation-area.md)                     | The operation area: an area style that offers its map                    | Accepted                      |
| [0030](0030-weather-warnings.md)                   | Official weather warnings, gathered by the server from MeteoAlarm        | Accepted                      |
| [0031](0031-practice-mode.md)                      | Practice mode: a simulated group played on the device                    | Accepted                      |
