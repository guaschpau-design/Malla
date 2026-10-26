# Changelog

All notable changes to Tesel. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Protocol versions are separate: see [`docs/protocol.md`](docs/protocol.md) §9.

## [0.1.0] - Unreleased

The first version: a shared map for a group, over the internet, over MeshCore LoRa radios and through a command post, with the web app as the only client ([ADR-0016](docs/decisions/0016-web-app-and-native-shells.md)).

### Map

- OpenStreetMap vector base map, installable as an app and usable offline.
- Areas downloaded tile by tile for offline use ([ADR-0011](docs/decisions/0011-client-side-area-download.md)).
- The base map (Spain, Portugal and the islands) is built from OpenStreetMap by our own server and served by it and by command posts.

### Groups

- Local identity with no accounts: an alias and a key pair generated on the device.
- Groups with coordinator and member roles; invitations by link or QR code, scanned in any browser.
- One binary event format on every transport, end-to-end encrypted with the group secret ([protocol v1](docs/protocol.md)).

### Situational awareness

- Live positions with three privacy modes: sharing, paused and hidden.
- Group chat.
- Markers, lines, areas and circles with a symbol catalogue, editable by any member.
- SOS calls with kind, position and acknowledgements; cancellation by the sender or a coordinator.
- Alerts from coordinators at three levels; critical alerts stay until acknowledged.

### Transports

- Internet: a zero-knowledge relay that stores and forwards encrypted envelopes (protocol §8).
- MeshCore LoRa through a companion radio over Web Bluetooth (protocol §7), with priorities, a legal airtime budget, position thinning, SOS repeats and bridging between radio and internet by any member who has both ([ADR-0015](docs/decisions/0015-lora-airtime-policy.md)).
- Text messages of other MeshCore apps are kept, read-only, in a chat tab.
- Command post: a laptop or Raspberry Pi with its own Wi-Fi that replicates the group's server; apps find it by name and sync through it when the server cannot be reached ([ADR-0018](docs/decisions/0018-command-post.md)).

### Deployment

- Server image with the relay, the landing page and the web app, for amd64 and arm64 ([ADR-0017](docs/decisions/0017-server-serves-site-and-app.md)).
- One-command, hardened, self-updating VPS install ([ADR-0013](docs/decisions/0013-self-updating-vps.md)) and command post kit.
- Landing page and user guide at tesel.eu, in Spanish and English, with annotated screenshots of the app and diagrams of how it connects.
- Brand: a mark of three hexagonal tiles and an Archivo wordmark, used on the site, the app and its icons.
- The project is called Tesel, formerly Teselia ([ADR-0019](docs/decisions/0019-name-tesel.md)); `tesel.eu` is its domain and the VPS redirects `teselia.eu` to it.

### Known limits

- Phones must keep the app open: no background position or notifications until the Android and iOS apps (ADR-0016).
- iPhones cannot pair a radio from Safari; they use the internet or a command post.
- Over LoRa, members can impersonate each other and channel encryption is weak ([ADR-0010](docs/decisions/0010-lora-link-security.md)).
- MeshCore `data_type` 0xFF4D is in the development range until registered.
- Radios and command posts have been tested in software only; field tests are pending ([`docs/prueba-de-campo.md`](docs/prueba-de-campo.md)).
