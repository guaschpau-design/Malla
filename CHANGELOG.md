# Changelog

All notable changes to Tesel. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Protocol versions are separate: see [`docs/protocol.md`](docs/protocol.md) §9.

## [0.1.0] - Unreleased

The first version: a shared map for a group, over the internet, over MeshCore LoRa radios and through a command post, with the web app as the only client ([ADR-0016](docs/decisions/0016-web-app-and-native-shells.md)).

### Map

- OpenStreetMap vector base map, installable as an app and usable offline.
- This device on the map where it is now, with its accuracy, and a button that keeps the map centred on it. The GPS runs only while something uses it.
- Coordinates in decimal degrees, degrees-minutes-seconds, UTM and MGRS ([ADR-0021](docs/decisions/0021-coordinate-formats.md)): a long press on the map shows a point's coordinates, ready to copy, and coordinates typed as they were dictated are found on the map. Markers and circles show theirs.
- Distance and bearing from this device to any point, marker, circle or member, and guidance to it: a card with the distance, the bearing and an arrow that points the way on the map, and a line to follow. The target moves with a member and the guidance ends if it leaves the map.
- A measuring tool for distances along a path and the area it encloses; lines, areas and circles show their length, area or radius.
- Members on the map can be tapped for who they are, their last position and the way there.
- Trails: where each member has been in the last hours, drawn from the positions they share. Hiding one's position hides the trail up to that moment too.
- Map layers: members, trails and markers and zones can each be hidden; the choice is remembered. This device and SOS calls are always shown.
- What reaches this device from each member, and how: a member's details say when something of theirs last arrived by radio, through the server or through a command post, and the members list marks those the radio hears.
- Keep the screen on, as an option, and always while guiding to a target.
- The operation diary: everything that happened in the group, in order and in plain words, downloadable as text for the report ([ADR-0022](docs/decisions/0022-log-files.md)).
- The group's log can be saved to a file, encrypted for the group, and loaded on another device of the group to bring it what it is missing (protocol §10).
- A tools menu gathers the diary, coordinates, measuring, map layers, offline maps and keeping the screen on.
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
- The top bar says in plain words how the device reaches its group — internet, a command post, the radio, several at once, connecting or no connection — and opens a panel with each connection in detail.
- Command post: a laptop or Raspberry Pi with its own Wi-Fi that replicates the group's server; apps find it by name and sync through it when the server cannot be reached ([ADR-0018](docs/decisions/0018-command-post.md)).

### Deployment

- Server image with the relay, the landing page and the web app, for amd64 and arm64 ([ADR-0017](docs/decisions/0017-server-serves-site-and-app.md)).
- One-command, hardened, self-updating VPS install ([ADR-0013](docs/decisions/0013-self-updating-vps.md)) and command post kit.
- Landing page and user guide at tesel.eu, in Spanish and English, with annotated screenshots of the app and diagrams of how it connects.
- Brand: a mark of three hexagonal tiles, one in signal lime, and an Archivo wordmark, used on the site, the app and its icons ([ADR-0020](docs/decisions/0020-colour-and-symbols.md)).
- Map symbols of our own: pictograms on hexagonal tiles, coloured by family, chosen from a grid of symbols.
- The project is called Tesel, formerly Teselia ([ADR-0019](docs/decisions/0019-name-tesel.md)); `tesel.eu` is its domain and the VPS redirects `teselia.eu` to it.

### Known limits

- Phones must keep the app open: no background position or notifications until the Android and iOS apps (ADR-0016).
- iPhones cannot pair a radio from Safari; they use the internet or a command post.
- Over LoRa, members can impersonate each other and channel encryption is weak ([ADR-0010](docs/decisions/0010-lora-link-security.md)).
- MeshCore `data_type` 0xFF4D is in the development range until registered.
- Radios and command posts have been tested in software only; field tests are pending ([`docs/prueba-de-campo.md`](docs/prueba-de-campo.md)).
