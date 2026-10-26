# Architecture

This document explains how Tesel is put together: the pieces, what each one owns, and how they talk. Read it before changing code. Decisions and their reasons live in [`docs/decisions/`](docs/decisions/); the wire format lives in [`docs/protocol.md`](docs/protocol.md).

> Product scope and goals are in [`docs/briefing.md`](docs/briefing.md) (Spanish). The name was chosen in [ADR-0019](docs/decisions/0019-name-tesel.md).

## 1. The idea in one paragraph

A group shares a map. Every change to that map — a position, a chat line, a marker, an SOS — is an **event**: a small, immutable, binary record with an author and a sequence number. Devices keep a local log of events and derive the current picture from it. Events travel over whatever link is available — the internet through a server, or LoRa through a MeshCore radio — and are **byte-for-byte the same on every link**. Any device that has two links forwards events between them. There is no authority: whoever holds the group secret can read and write, and the server only ever sees ciphertext.

## 2. Components

```
┌─────────────────────────── apps/web (PWA) ────────────────────────────┐
│  UI (Svelte) ── map (MapLibre + PMTiles)                              │
│        │                                                              │
│        ▼                                                              │
│  packages/core: state reducer · LoRa scheduler · bridge rules         │
│        │                                                              │
│        ▼                                                              │
│  packages/protocol: event codec · crypto · invitations                │
│        │                                   │                          │
│  internet transport (WebSocket)     packages/meshcore (Web Bluetooth) │
└────────┼───────────────────────────────────┼──────────────────────────┘
         │                                   │ BLE
         ▼                                   ▼
   apps/server (VPS or                 MeshCore companion radio
   local command post)                  ⇄ LoRa mesh ⇄ other radios
```

| Path                | Owns                                                                                           | Must not depend on                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/protocol` | Binary event format, key derivation, envelope encryption, invitation links                     | Anything else in the repo; the DOM; Node APIs        |
| `packages/core`     | State reducer, LoRa airtime scheduler, bridge rules                                            | The DOM, Svelte, BLE, network APIs                   |
| `packages/meshcore` | Talking to a MeshCore companion radio: connect, configure channel, send and receive datagrams  | `packages/core`, the UI                              |
| `packages/scenario` | Staged operations as data, planned into the events their members send                          | The DOM, Node APIs, any transport                    |
| `apps/web`          | UI, map, persistence in IndexedDB (event log, outbox, cursors), wiring transports to `core`    | Server code                                          |
| `apps/server`       | Storing and relaying encrypted envelopes; serving the landing page and the web app (ADR-0017)  | Plaintext event contents (it can never decrypt them) |
| `apps/site`         | The landing page at tesel.eu: static HTML and CSS, Spanish and English                         | Any build step or third-party request                |
| `tools/simulator`   | Scenarios played by simulated devices through the relay, for demos, load tests and screenshots | The apps: it reaches them only through the protocol  |

The dependency direction is strictly downwards in the diagram. `protocol` and `core` are pure TypeScript with no I/O, so they run unchanged in the browser, in Node and in tests. This is what keeps the hard parts testable.

## 3. Data model

### 3.1 Identity

Each device generates an Ed25519 key pair on first launch, when the user picks an alias, and never sends the private key anywhere. Its **node ID** is the first 4 bytes of `SHA-256(publicKey)`, shown as 8 hex characters. There are no accounts.

### 3.2 Group

A group is defined by a random 16-byte **group secret**. Everything else is derived from it (see [`docs/protocol.md`](docs/protocol.md) §5):

| Derived value          | Used for                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| The secret itself      | MeshCore channel key; the radio encrypts LoRa traffic with it          |
| Group ID (16 bytes)    | Public routing identifier on servers; reveals nothing about the secret |
| Content key (32 bytes) | AES-256-GCM encryption of events sent over the internet                |
| Event key (HMAC)       | Lets the server de-duplicate envelopes without learning who sent them  |

People join by scanning an **invitation** (QR code or link) that carries the group name, the secret, the role being granted and, optionally, a server URL. The secret travels in the URL fragment, which browsers never send to servers, and the app removes it from the address bar as soon as it has read it ([ADR-0012](docs/decisions/0012-invitation-links-under-a-base-path.md)). A QR code can be scanned with the phone's camera app, which opens the link, or from inside the app. On iPhone only the second works for an installed app, whose storage is separate from Safari's.

A device can belong to several groups; one is **active** at a time. Joining a group the device already belongs to never demotes it: a coordinator invitation promotes a member, a member invitation changes nothing.

Roles (coordinator, member) are carried in invitations and shown in the UI. In v0.1 they are **advisory**: anyone holding the secret is technically able to send any event. The UI applies these rules, which the protocol does not enforce:

| Action                                     | Who, in the UI              |
| ------------------------------------------ | --------------------------- |
| Create invitations (member or coordinator) | Coordinators                |
| Send alerts                                | Coordinators                |
| Cancel an SOS                              | Its sender and coordinators |
| Draw, edit and delete map objects          | Everyone                    |
| Send an SOS, chat, acknowledge             | Everyone                    |

#### Position privacy

The device reads its GPS only while something uses it — sharing, showing it on the map, navigating — through one reader (`lib/position/device-location.svelte.ts`) that every use shares. Each device chooses how it shares its position, and remembers the choice: **sharing** (positions are published as the device moves), **paused** (nothing new is published; the group keeps the last position, which turns stale) or **hidden** (a `POSITION_HIDDEN` removes the device from the group's map). See [ADR-0005](docs/decisions/0005-group-secret-trust-boundary.md).

### 3.3 Events

An event has a fixed 14-byte header — protocol version, type, origin node ID, sequence number, timestamp — followed by a type-specific payload. The full list of types and their byte layouts is in [`docs/protocol.md`](docs/protocol.md) §3. In short:

| Type                               | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- |
| `MEMBER_INFO`                      | Alias, role and public key of a member          |
| `POSITION`, `POSITION_HIDDEN`      | Live position, or "I stopped sharing"           |
| `CHAT`                             | Group chat line                                 |
| `MARKER`, `SHAPE`, `OBJECT_DELETE` | Map objects: points, lines, polygons, circles   |
| `SOS`, `SOS_CANCEL`                | Emergency call and its cancellation             |
| `ALERT`                            | Broadcast warning with a severity level         |
| `ACK`                              | Acknowledges an event (used for SOS and alerts) |

`(origin, seq)` uniquely identifies an event. Sequence numbers are per device, start at 1, normally increase by one and are persisted, so a device never reuses one.

### 3.4 Deriving state

The current picture is a pure function of the event log, computed by the reducer in `packages/core`. The state is composed of **slices**, one module per domain in `packages/core/src/state/`: each declares the event types it reads, its empty value and how one more event changes it. The reducer routes each event to the slices that read it and leaves the others untouched, so unchanged slices keep their identity and the UI only recomputes what changed.

- **Positions:** latest `POSITION` or `POSITION_HIDDEN` per origin.
- **Trails:** the newest positions of each origin, in order, for drawing where members have been. A `POSITION_HIDDEN` cuts the trail: positions up to it are dropped, so hiding also hides where one went.
- **Map objects:** identified by the `(origin, seq)` of the event that created them. Later `MARKER`/`SHAPE` events for the same object replace it; `OBJECT_DELETE` removes it. Conflicts resolve by **last writer wins**, ordering by `(timestamp, origin, seq)`.
- **Chat and alerts:** append-only, ordered by `(timestamp, origin, seq)` so every device shows the same order.
- **SOS:** every `SOS` is kept; one is active until a `SOS_CANCEL` for it arrives, and the first cancellation (by the same order) says who cancelled it.
- **Acknowledgements:** per acknowledged event, the first `ACK` of each member.
- **Journal:** every event except positions, in order: the record from which the app writes the operation diary ([ADR-0022](docs/decisions/0022-log-files.md)).

Events can arrive late, twice or out of order — through LoRa, a bridge and the server at once. The reducer is idempotent and order-independent, so this never matters. This is the property the tests protect most. See [ADR-0003](docs/decisions/0003-event-log-last-writer-wins.md).

### 3.5 Adding an event type

A new capability is a new event type (protocol §3.2 and §9: no version change). It touches one place in each layer, and the compiler or a test points at any that is missing:

1. **Spec first:** its code and layout in [`docs/protocol.md`](docs/protocol.md) §3, its size within the 165-byte budget.
2. **Protocol:** the type in `packages/protocol/src/events.ts`, the code in `constants.ts`, and its layout (writer next to reader) in `payloads.ts`, whose record is keyed by every event type. A round-trip sample goes in `test-helpers.ts`; a test fails while a type has none.
3. **State:** a slice in `packages/core/src/state/`, or an existing slice that also reads the type, listed in `reducer.ts`. A test fails while a known type has no slice.
4. **Radio:** its urgency in `packages/core/src/urgency.ts`, a record keyed by every event type.
5. **App:** the action that publishes it in `GroupFeed` and the UI that shows it, with texts in both languages.

## 4. Transports

### 4.1 Internet

The web app keeps a WebSocket to the active group's server; groups that are not active sync when they are opened. Each event is sealed into an **envelope** — AES-256-GCM ciphertext plus an opaque event key — and pushed. The server assigns each envelope a per-group **cursor** (an increasing integer), stores it, and fans it out to the group's other connections. On reconnect a client asks for everything after the last cursor it saw. Envelopes that arrive together are handled in batches of up to a thousand: each batch is stored in one transaction together with its cursor, which therefore never runs ahead of the log, and applied to the state in one update. A device back after hours without coverage catches up in seconds rather than one envelope per screen frame. The server cannot read, forge or alter events; it can only drop them.

### 4.2 LoRa (MeshCore)

The web app connects to a MeshCore companion radio over Web Bluetooth (Chrome and Edge only), stores the group secret in one of the radio's channel slots, and sends each event's raw bytes as a **channel data datagram** with Tesel's `data_type`. The radio floods it through the mesh and encrypts it with the channel key; other radios on the same channel deliver it to their apps. See [ADR-0006](docs/decisions/0006-meshcore-first-channel-datagrams.md).

LoRa is slow and legally limited to 10 % airtime in the EU 869.4–869.65 MHz sub-band, so outgoing LoRa traffic goes through a **scheduler** in `packages/core` ([ADR-0015](docs/decisions/0015-lora-airtime-policy.md)) that:

1. Orders events by priority: `SOS` > `SOS_CANCEL` > `ALERT` > `POSITION_HIDDEN` > `ACK` > `CHAT` > map objects (`MARKER`, `SHAPE`, `OBJECT_DELETE`) > `MEMBER_INFO` > `POSITION`. `POSITION_HIDDEN` is never thinned or delayed, and it drops any position still queued: a user who stops sharing must disappear from the map promptly.
2. Estimates each packet's airtime from the radio preset and keeps a rolling one-hour budget: 5 % of the hour for ordinary traffic, the legal 10 % for `SOS`, `SOS_CANCEL` and alerts.
3. Thins own positions: at most one every 2 minutes, and only after moving 50 m or 10 minutes passing.
4. Repeats an own `SOS` with back-off (30 s, doubling to 5 minutes) until an `ACK` or a `SOS_CANCEL` arrives over any transport.
5. Applies the protocol's ACK rule: an own `ACK` waits 2–30 s and is dropped if another member's `ACK` is heard first.

When a radio is linked to a group, the device also queues its own latest `MEMBER_INFO`, so members who only hear the radio learn its alias. While connected, Tesel reads every message the radio holds. Text messages of other MeshCore apps are kept on the device and shown, read-only, in a MeshCore tab of the chat, so they are not lost.

### 4.3 Bridging

A device connected to both the server and a radio is a **bridge**, with no configuration:

- Every event heard on LoRa is pushed to the server.
- Events from the server are sent to LoRa through the scheduler, except positions, which are forwarded at most once every 5 minutes per origin, and events older than 10 minutes, which are history rather than news.
- To avoid several bridges repeating the same event over the air, a bridge waits a random 0–10 seconds before forwarding to LoRa and skips the event if it has meanwhile heard it on LoRa.
- An event already seen on a transport is never sent back to that transport.

## 5. Operating modes

The code is the same in every mode; what differs is what is reachable.

| Mode         | Reachable            | Behaviour                                                                                                                                                                                                                                    |
| ------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connected    | Server               | Sync through the VPS; LoRa as fallback if paired                                                                                                                                                                                             |
| Mesh         | Radio only           | Events flow radio to radio; each device keeps its own log                                                                                                                                                                                    |
| Command post | Post's Wi-Fi + radio | A laptop or Raspberry Pi runs `apps/server` with `TESEL_UPSTREAM` and its own Wi-Fi; phones without a radio (including iPhones) sync through it; a browser on the post bridges to LoRa; the post replicates the VPS whenever it has internet |

A command post is found by name and replicates by protocol ([ADR-0018](docs/decisions/0018-command-post.md), protocol §8.2–8.3):

- All posts of a server share one name, which each post resolves to itself on its own Wi-Fi, with a certificate obtained beforehand by DNS challenge.
- The server announces that name in `healthz`. Apps try the group's server first and the post next, keeping one cursor per relay, so moving between them loses nothing.
- The post keeps one upstream connection per group: it stores what the upstream has and pushes what its clients pushed. It moves envelopes only, like any server.

## 6. Persistence

| Where   | What                                                                                     | Technology                                                               |
| ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Browser | Identity keys, groups, settings, each group's event log, the outbox and sync cursors     | IndexedDB database `tesel`                                               |
| Browser | Offline map tiles by source, with the areas they belong to                               | IndexedDB database `tesel-map`, separate so it can be cleared on its own |
| File    | A group's log, saved and loaded by hand: its events sealed as for a relay (protocol §10) | JSON                                                                     |
| Server  | Encrypted envelopes per group, with retention limit                                      | SQLite through `node:sqlite`                                             |
| Server  | Base map                                                                                 | One PMTiles file, served as a static file with range requests            |

## 7. Maps

The base map is OpenStreetMap data rendered as vector tiles from a single PMTiles file that **we host**. The public OpenStreetMap tile servers forbid bulk downloading, so they cannot be used for offline maps. To prepare for an incident, the web app downloads every tile of an area, up to zoom 14, straight from that file and stores it in IndexedDB. MapLibre reads tiles through a `tesel-tiles://` protocol that answers from IndexedDB first and the network second. Glyphs and sprites ship inside the app. See [ADR-0007](docs/decisions/0007-self-hosted-vector-maps.md) and [ADR-0011](docs/decisions/0011-client-side-area-download.md).

Two more base maps cover Spain: the topographic map and the orthophotos of the Instituto Geográfico Nacional, open web map services the browser reads directly through the same protocol. An offline area can include them; every downloaded tile is kept under its source ([ADR-0023](docs/decisions/0023-ign-base-maps.md)). The relief — shading and the climb of a way — comes from the open Terrain Tiles, read the same way ([ADR-0024](docs/decisions/0024-terrain-tiles-for-relief.md)).

## 8. Security model

| Threat                                 | Mitigation in v0.1                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server operator reads the group's data | Impossible: events are end-to-end encrypted with a key the server never sees                                                                                                                                                    |
| Eavesdropper on LoRa                   | MeshCore encrypts channel traffic with the group secret, but with AES-128-ECB and a 2-byte MAC: enough against casual listening, weak against a determined attacker (see [ADR-0010](docs/decisions/0010-lora-link-security.md)) |
| Outsider joins the group               | Requires the secret, which only travels inside invitations                                                                                                                                                                      |
| Member impersonates another member     | **Not prevented in v0.1** — anyone with the secret can forge any origin. Signatures do not fit LoRa's 165-byte budget; planned for internet traffic later                                                                       |
| Lost or seized phone                   | Group secrets and the device key sit unencrypted in the browser's storage, protected only by the phone's own lock. Leaving a group deletes its secret from the device                                                           |
| Leaked secret                          | Coordinator creates a new group and re-invites; key rotation is future work                                                                                                                                                     |
| Server flooded with junk               | Rate limits per connection and per group. The group ID is enough to push envelopes; a membership token derived from the secret is future work                                                                                   |

## 9. Repository layout

```
apps/web/            PWA: UI, map, storage, transport wiring
apps/server/         Relay and storage server, serves site and app; replication for command posts
apps/site/           Landing page (static)
brand/               Mark, wordmark and lockup (SVG) and the script that builds them
packages/protocol/   Wire format, crypto, invitations (pure TS)
packages/core/       Reducer, scheduler, bridge rules (pure TS)
packages/meshcore/   MeshCore radio adapter
packages/scenario/   Staged operations as data and their plan (pure TS): simulator and practice mode
tools/simulator/     Scenarios played by simulated devices: demos, load tests, screenshots
docs/                Briefing, protocol spec, decisions
deploy/              VPS, command post kit, GitHub Pages redirect
```
