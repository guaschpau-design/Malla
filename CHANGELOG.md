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
- Map layers: members, trails, markers and zones, tasks, services and weather warnings can each be hidden; the choice is remembered. The panel groups its switches by what they are about: the team, the surroundings, and finding one's way (radar, MGRS grid). This device and SOS calls are always shown.
- What reaches this device from each member, and how: a member's details say when something of theirs last arrived by radio, through the server or through a command post, and the members list marks those whose news arrives by radio.
- Keep the screen on, as an option, and always while guiding to a target.
- The operation diary: everything that happened in the group, in order and in plain words, downloadable as text for the report ([ADR-0022](docs/decisions/0022-log-files.md)).
- The group's log can be saved to a file, encrypted for the group, and loaded on another device of the group to bring it what it is missing (protocol §10).
- A simpler screen: the SOS button and a dock — Me (where you are and how you share your position), Add, Chat, Tasks and More. Everything else starts from what is touched on the map: a point, a marker or a member opens what can be done there (guide, mark, measure). The map's controls are one ink group, like the dock: a needle that puts north back up, this device and the map layers; zoom is by pinching. The map's credits show in small print when it opens and stay in the layers panel; the scale sits under the map's controls ([ADR-0039](docs/decisions/0039-map-credits-and-scale.md)).
- One look throughout: every corner, shadow and size of text comes from a few shared values, the chrome around the map (top bar, dock, map controls) is ink and what it shows sits on cards, and map lines and labels turn pale in the dark theme. Points placed on the map, by drawing, measuring or a long press, are fine targets with a dot on the exact spot.
- A refined logo: tighter tiles that weigh as much as the word, in a bolder Archivo.
- Short panels, made to read at a glance: the base map is chosen by its picture and layers are switched on and off; Me has three buttons to share, pause or hide one's position, says how precise the GPS is (good, fair or poor), and keeps the coordinate format in a drop-down, as every panel with coordinates does; "Screen always on" is a switch.
- Topographic map and aerial photographs of Spain, Portugal and southern France, as base maps chosen in the map layers panel, and downloadable with an offline area: each country's newest orthophotos (IGN's PNOA, DGT's OrtoSat 2023, IGN France's BD ORTHO), joined where a tile crosses a border ([ADR-0023](docs/decisions/0023-ign-base-maps.md), [ADR-0037](docs/decisions/0037-maps-across-borders.md)). The topographic map is drawn from vector data, sharp at every zoom and with a dark version: the street map in a topographic palette with contour lines worked out on the device from the elevation, their heights, and in Spain IGN's names of mountains, places, ravines, caves and springs ([ADR-0034](docs/decisions/0034-vector-topographic-map.md)).
- Each base map has its own job: the street map, with neutral land, buildings and roads coloured by class, is for finding a street and a way in; the topographic map for the terrain; the satellite map for the ground as it is ([ADR-0035](docs/decisions/0035-base-maps-by-purpose.md)).
- The cadastre, as a layer: parcels with their numbers and, in Spain, the rural polygons, how a plot in the countryside is named, from the cadastre services of Spain and France, one picture of the view at a time and only online, as its terms ask ([ADR-0036](docs/decisions/0036-cadastre-layer.md)).
- Relief, as an option: hills and valleys shaded on any base map, and the climb, descent and steepest stretch of the way to a point, shown with its distance and while guiding, from Mapterhorn's elevation, built from each country's best open model ([ADR-0024](docs/decisions/0024-terrain-tiles-for-relief.md), [ADR-0037](docs/decisions/0037-maps-across-borders.md)).
- Tasks: a short text, typed or picked from nine common ones (search the area, check a home, treat an injured person…), and, if wanted, who should do it and a place on the map; to do, in progress or done. Anyone can add one from the Tasks button or with "Task here" on a point or an object, take it, finish it or hand it on. The dock counts this device's tasks and a notice says when someone hands one over; tasks with a place show on the map, and the diary tells how each moved along. A new event type, `TASK`, carries each change in one radio message (protocol §3.11, [ADR-0025](docs/decisions/0025-tasks.md)).
- Public services on the map: health centres and hospitals, pharmacies, fire stations, police, helipads, town halls and fuel stations from the base map, with round icons from zoom 12, a «Servicios» layer switch, and their point with guidance when tapped. They work offline in downloaded areas ([ADR-0027](docs/decisions/0027-public-services-from-the-base-map.md)).
- Official weather warnings: the yellow, orange and red warnings of AEMET and IPMA, gathered by the server from MeteoAlarm, hatch their regions on the map, unlike the group's own areas, with a cloud on a rounded square ([ADR-0038](docs/decisions/0038-official-warnings-look.md)); a card says what is in force where this device is, and a long press shows those at any point. They are kept for use without coverage, and have their own layer switch. The server publishes them for any app at `v1/weather-warnings` (protocol §8.4, [ADR-0030](docs/decisions/0030-weather-warnings.md)).
- Practice mode: a group of four simulated teammates around this device, who walk, mark what they find, talk in the chat and call an SOS, and who answer a roll call or an SOS. Nothing leaves the device, and the practice ends with the app ([ADR-0031](docs/decisions/0031-practice-mode.md)).
- The MGRS grid over the map, as a switch in the map layers: lines every 100 km down to 100 m as the zoom allows, with their digits, the 100 km squares named and the edges of UTM zones ([ADR-0021](docs/decisions/0021-coordinate-formats.md)).
- Radio line of sight: from any point, whether the terrain lets a LoRa signal reach another point or this device, with the antenna height at each end. The Earth's curve and the room the signal needs (60 % of the first Fresnel zone at 869 MHz) are counted; the answer is sure when the terrain cuts the line, «marginal» when it may, and «clear over the terrain» otherwise, buildings and trees not counted ([ADR-0032](docs/decisions/0032-radio-line-of-sight.md)).
- A warning on entering a danger area: each device compares its own position with the group's danger areas and vibrates and shows which one, offline too; the GPS stays on while there is one ([ADR-0033](docs/decisions/0033-danger-area-warning.md)).
- The radar, as a switch in the map layers: rings around this device at round distances that follow the zoom, and dashed lines to the five nearest members with a recent position, each with its distance and bearing. It keeps the GPS on while shown.
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
- Group chat, with dictation: a microphone in the text box writes what is said, in Spanish, with the phone's speech recognition, to be checked and sent ([ADR-0040](docs/decisions/0040-dictated-messages.md)).
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
