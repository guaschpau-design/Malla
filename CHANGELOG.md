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
- Map layers: members, trails, markers and zones, and tasks can each be hidden; the choice is remembered. This device and SOS calls are always shown.
- What reaches this device from each member, and how: a member's details say when something of theirs last arrived by radio, through the server or through a command post, and the members list marks those whose news arrives by radio.
- Keep the screen on, as an option, and always while guiding to a target.
- The operation diary: everything that happened in the group, in order and in plain words, downloadable as text for the report ([ADR-0022](docs/decisions/0022-log-files.md)).
- The group's log can be saved to a file, encrypted for the group, and loaded on another device of the group to bring it what it is missing (protocol §10).
- A simpler screen: the SOS button and a dock — Me (where you are and how you share your position), Add, Chat, Tasks and More. Everything else starts from what is touched on the map: a point, a marker or a member opens what can be done there (guide, mark, measure). Map layers sit under the zoom.
- Short panels, made to read at a glance: the base map is chosen by its picture and layers are switched on and off; Me has three buttons to share, pause or hide one's position, says how precise the GPS is (good, fair or poor), and keeps the coordinate format in a drop-down, as every panel with coordinates does; "Screen always on" is a switch.
- Topographic map and aerial photographs of Spain from the IGN, as base maps chosen in the map layers panel, and downloadable with an offline area ([ADR-0023](docs/decisions/0023-ign-base-maps.md)).
- Relief, as an option: hills and valleys shaded on any base map, and the climb, descent and steepest stretch of the way to a point, shown with its distance and while guiding ([ADR-0024](docs/decisions/0024-terrain-tiles-for-relief.md)).
- Tasks: a short text and, if wanted, who should do it and a place on the map; to do, in progress or done. Anyone can add one from the Tasks button or with "Task here" on a point or an object, take it, finish it or hand it on. The dock counts this device's tasks and a notice says when someone hands one over; tasks with a place show on the map, and the diary tells how each moved along. A new event type, `TASK`, carries each change in one radio message (protocol §3.11, [ADR-0025](docs/decisions/0025-tasks.md)).
- Public services on the map: health centres and hospitals, fire stations, police, helipads and town halls from the base map, with round icons from zoom 14, a «Servicios» layer switch, and their point with guidance when tapped. They work offline in downloaded areas ([ADR-0027](docs/decisions/0027-public-services-from-the-base-map.md)).
- Areas downloaded tile by tile for offline use ([ADR-0011](docs/decisions/0011-client-side-area-download.md)).
- The operation area: a coordinator draws an area with the operation area style, and every member is offered its map to download, with its size, in one tap ([ADR-0029](docs/decisions/0029-operation-area.md), protocol §4.2).
- The base map (Spain, Portugal and the islands) is built from OpenStreetMap by our own server and served by it and by command posts.

### Groups

- Local identity with no accounts: an alias and a key pair generated on the device.
- Groups with coordinator and member roles; invitations by link or QR code, scanned in any browser.
- Groups in one panel: the group in use with its members, shown by their initials with signs for a live position and for radio, and two buttons, Create and Join; the server of a new group is proposed and tucked away.
- One binary event format on every transport, end-to-end encrypted with the group secret ([protocol v1](docs/protocol.md)).

### Situational awareness

- Live positions with three privacy modes: sharing, paused and hidden.
- Group chat.
- Markers and areas with a symbol catalogue, editable by any member. Lines and circles from other clients are shown (protocol §3.7).
- SOS calls with kind, position and acknowledgements; cancellation by the sender or a coordinator.
- Alerts from coordinators: a chat message sent as an alert stays on every screen until acknowledged ([ADR-0026](docs/decisions/0026-one-kind-of-alert.md)).
- Roll call: a coordinator calls it from the chat; each member answers «Estoy bien» or «Necesito ayuda» (which opens the SOS), and the caller sees who has not answered yet. One new event, `ROLL_CALL`, answered with ACKs that LoRa never drops for another member's answer ([ADR-0028](docs/decisions/0028-roll-call.md), protocol §3.12).

### Transports

- Internet: a zero-knowledge relay that stores and forwards encrypted envelopes (protocol §8).
- MeshCore LoRa through a companion radio over Web Bluetooth (protocol §7), with priorities, a legal airtime budget, position thinning, SOS repeats and bridging between radio and internet by any member who has both ([ADR-0015](docs/decisions/0015-lora-airtime-policy.md)).
- Text messages of other MeshCore apps are kept, read-only, in a chat tab.
- The top bar names what the device reaches its group through — WiFi, 4G/5G, LoRa, several at once — with a green, orange or red dot, and opens a panel with one card per connection. Browsers that do not say whether they use Wi-Fi or mobile data show "WiFi/5G".
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
