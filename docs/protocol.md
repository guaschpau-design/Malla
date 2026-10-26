# Tesel protocol, version 1

This is the normative specification of everything Tesel puts on the wire. It is written so that someone could build a compatible implementation without reading our code. When code and this document disagree, the document wins and the code is a bug — unless the pull request changes both.

Keywords MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## 1. Conventions

- Multi-byte integers are **little-endian**, matching MeshCore.
- `u8`, `u16`, `u32` are unsigned; `i16`, `i32` are two's-complement signed.
- Text is UTF-8. Encoders MUST NOT split a code point; decoders MUST reject invalid UTF-8.
- A **text-rest** field is the last field of a payload and runs to its end, with no length prefix.
- A **text-u8** field is a `u8` byte length followed by that many bytes.
- **Coordinates** are `i32` in units of 10⁻⁷ degrees (about 1.1 cm). Latitude is within ±90°, longitude within ±180°; decoders MUST reject values outside these ranges.
- **Node ID**: 4 bytes, the first 4 bytes of `SHA-256(ed25519PublicKey)`.
- **Event reference**: 8 bytes, a node ID followed by a `u32` sequence number. It points to the event with that `(origin, seq)`.
- `base64url` means RFC 4648 §5 without padding.

## 2. Size budget

The largest MeshCore channel datagram payload is **165 bytes**. Every event, on every transport, MUST be at most 165 bytes once encoded. Encoders MUST refuse to produce larger events; the user interface is responsible for keeping text short enough.

## 3. Events

### 3.1 Header

Every event starts with a 14-byte header:

| Offset | Size | Field     | Notes                                                           |
| ------ | ---- | --------- | --------------------------------------------------------------- |
| 0      | 1    | `version` | `u8`, `1` for this specification                                |
| 1      | 1    | `type`    | `u8`, see §3.2                                                  |
| 2      | 4    | `origin`  | Node ID of the author                                           |
| 6      | 4    | `seq`     | `u32`, per-origin sequence number, starting at 1                |
| 10     | 4    | `time`    | `u32`, seconds since 1970-01-01 UTC, when the event was created |

The payload follows, up to 151 bytes.

- A device MUST persist its last `seq` and MUST NOT reuse a value. It SHOULD increase `seq` by exactly one per event, so receivers can detect gaps. `seq` `0` is invalid.
- `(origin, seq)` identifies an event globally within a group. Receivers MUST treat a second copy as a duplicate, whatever transport it came from.
- Receivers MUST ignore events whose `version` they do not support, and events whose `type` they do not know. They MUST NOT treat these as errors that affect other events.
- Bridges and servers MUST forward events of unknown type unchanged, using the header alone for de-duplication. This lets newer clients use new types through older infrastructure.
- **Reserved values.** When an enumerated field holds a reserved value, decoders MUST use the default given for that field below, so that newer senders never make older receivers drop information. The one exception is `SHAPE.kind`, whose geometry cannot be parsed without it; an event with a reserved shape kind is ignored.

### 3.2 Types

| Code   | Name              | Payload                                                |
| ------ | ----------------- | ------------------------------------------------------ |
| `0x01` | `MEMBER_INFO`     | §3.3                                                   |
| `0x02` | `POSITION`        | §3.4                                                   |
| `0x03` | `POSITION_HIDDEN` | Empty                                                  |
| `0x04` | `CHAT`            | §3.5                                                   |
| `0x05` | `MARKER`          | §3.6                                                   |
| `0x06` | `SHAPE`           | §3.7                                                   |
| `0x07` | `OBJECT_DELETE`   | Object reference (8 bytes)                             |
| `0x08` | `SOS`             | §3.8                                                   |
| `0x09` | `SOS_CANCEL`      | Event reference (8 bytes) of the `SOS` being cancelled |
| `0x0A` | `ALERT`           | §3.9                                                   |
| `0x0B` | `ACK`             | Event reference (8 bytes) of the event acknowledged    |

Codes are never reused. New capabilities are added as new types; existing layouts never change within version 1.

### 3.3 `MEMBER_INFO`

Announces who is behind a node ID. Sent on joining a group and when alias or role changes; over LoRa, also each time a radio starts carrying the group, so members who only hear the radio learn it.

| Size | Field       | Notes                                                                     |
| ---- | ----------- | ------------------------------------------------------------------------- |
| 1    | `role`      | `0` member, `1` coordinator; reserved values read as member               |
| 32   | `publicKey` | Ed25519 public key; receivers MUST check that its node ID equals `origin` |
| 1–32 | `alias`     | text-rest                                                                 |

### 3.4 `POSITION` and `POSITION_HIDDEN`

`POSITION` payload:

| Size | Field      | Notes                                           |
| ---- | ---------- | ----------------------------------------------- |
| 4    | `lat`      | Coordinate                                      |
| 4    | `lon`      | Coordinate                                      |
| 2    | `accuracy` | `u16`, metres, `0xFFFF` unknown                 |
| 2    | `heading`  | `u16`, degrees 0–359, `0xFFFF` unknown          |
| 2    | `speed`    | `u16`, centimetres per second, `0xFFFF` unknown |

Encoded size: 28 bytes.

`POSITION_HIDDEN` has no payload. It means "I stopped sharing my position"; receivers MUST stop showing the origin's last position until a newer `POSITION` arrives. As with objects, the newer of the two is decided by `(time, seq)`.

### 3.5 `CHAT`

| Size  | Field             |
| ----- | ----------------- |
| 1–151 | `text`, text-rest |

### 3.6 `MARKER`

Creates or replaces a point object.

| Size  | Field    | Notes                       |
| ----- | -------- | --------------------------- |
| 8     | `object` | Object reference, see §3.10 |
| 2     | `symbol` | `u16`, see §4               |
| 4     | `lat`    | Coordinate                  |
| 4     | `lon`    | Coordinate                  |
| 0–133 | `label`  | text-rest                   |

### 3.7 `SHAPE`

Creates or replaces a line, polygon or circle.

| Size | Field      | Notes                                                                    |
| ---- | ---------- | ------------------------------------------------------------------------ |
| 8    | `object`   | Object reference, see §3.10                                              |
| 1    | `kind`     | `1` polyline, `2` polygon, `3` circle; reserved values: ignore the event |
| 2    | `style`    | `u16`, see §4.2                                                          |
| 1+n  | `label`    | text-u8, 0–32 bytes                                                      |
| …    | `geometry` | Depends on `kind`                                                        |

**Polyline and polygon geometry:**

| Size            | Field   | Notes                                                                                                               |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 1               | `count` | `u8`, number of points; at least 2 for a polyline, 3 for a polygon                                                  |
| 4               | `lat0`  | First point, coordinate                                                                                             |
| 4               | `lon0`  | First point, coordinate                                                                                             |
| 4 × (count − 1) | deltas  | For each further point: `i16 dLat`, `i16 dLon` in units of 10⁻⁵ degrees, relative to the previous **decoded** point |

A decoder reconstructs point _i_ as point _i − 1_ plus `delta × 100` in coordinate units. An encoder MUST compute each delta from the previously reconstructed point, not from the original one, so rounding errors do not accumulate. If two consecutive points are more than 0.32767° apart on either axis, the encoder MUST insert intermediate points or reject the shape. Polygons are implicitly closed; the last point MUST NOT repeat the first.

With an empty label, a shape holds up to 33 points.

**Circle geometry:**

| Size | Field    | Notes                         |
| ---- | -------- | ----------------------------- |
| 4    | `lat`    | Centre, coordinate            |
| 4    | `lon`    | Centre, coordinate            |
| 4    | `radius` | `u32`, metres, greater than 0 |

### 3.8 `SOS`

| Size  | Field      | Notes                                                                                                     |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1     | `kind`     | `0` general, `1` medical, `2` trapped, `3` fire, `4` security; other values reserved and shown as general |
| 4     | `lat`      | Coordinate                                                                                                |
| 4     | `lon`      | Coordinate                                                                                                |
| 2     | `accuracy` | `u16`, metres, `0xFFFF` unknown                                                                           |
| 0–140 | `text`     | text-rest                                                                                                 |

An `SOS` stays active until a `SOS_CANCEL` referencing it is received. Any member MAY cancel an SOS; the interface SHOULD show who cancelled it. Senders SHOULD repeat an `SOS` over LoRa with back-off until at least one `ACK` for it is received. Repeats are byte-identical copies, so receivers de-duplicate them.

**Acknowledging over LoRa.** To keep acknowledgements from flooding the air, a receiver SHOULD send at most one `ACK` per `SOS` or critical `ALERT`, after a random delay of 2–30 seconds, and SHOULD NOT send it if it has meanwhile heard another member's `ACK` for the same event. Over the internet, every receiver MAY acknowledge immediately.

### 3.9 `ALERT`

| Size  | Field   | Notes                                                                       |
| ----- | ------- | --------------------------------------------------------------------------- |
| 1     | `level` | `0` information, `1` warning, `2` critical; reserved values read as warning |
| 1–150 | `text`  | text-rest                                                                   |

### 3.10 Objects

Map objects (`MARKER`, `SHAPE`) are identified by an **object reference**: the event reference of the event that created the object.

- To create an object, an event uses its own `(origin, seq)` as `object`.
- To change an object, any member sends a new `MARKER` or `SHAPE` with the same `object`. A change MAY switch between `MARKER` and `SHAPE`.
- To delete it, a member sends `OBJECT_DELETE` with the same `object`.
- The current state of an object is given by the event with the greatest `(time, origin, seq)` among all events with that `object`, compared in that order, with `origin` compared as 4 unsigned bytes. If that event is an `OBJECT_DELETE`, the object does not exist.
- Deletion is ordinary last-writer-wins: an edit newer than the delete brings the object back, and an older edit arriving late does not. This is intended; receivers MUST keep `OBJECT_DELETE` events so late edits can be compared against them.

## 4. Symbol and style codes

### 4.1 Symbols (`MARKER.symbol`)

| Range             | Use                                      |
| ----------------- | ---------------------------------------- |
| `0x0000`–`0x0FFF` | Civil symbol set, below                  |
| `0x1000`–`0x7FFF` | Reserved for NATO APP-6 mapping (future) |
| `0x8000`–`0xFFFF` | Reserved                                 |

| Code     | Meaning                   |
| -------- | ------------------------- |
| `0x0000` | Generic point             |
| `0x0001` | Injured person            |
| `0x0002` | Missing person, last seen |
| `0x0003` | Fire                      |
| `0x0004` | Flood                     |
| `0x0005` | Hazard                    |
| `0x0006` | Blocked road              |
| `0x0007` | Shelter                   |
| `0x0008` | Meeting point             |
| `0x0009` | Medical post              |
| `0x000A` | Water point               |
| `0x000B` | Helicopter landing zone   |
| `0x000C` | Command post              |

Receivers MUST display unknown codes as a generic point.

### 4.2 Styles (`SHAPE.style`)

| Code     | Meaning               |
| -------- | --------------------- |
| `0x0000` | Neutral               |
| `0x0001` | Danger area           |
| `0x0002` | Search area, assigned |
| `0x0003` | Search area, cleared  |
| `0x0004` | Safe area             |
| `0x0005` | Route                 |

Receivers MUST display unknown codes as neutral.

## 5. Group cryptography

A group is a 16-byte random **group secret** `S`, generated with a cryptographically secure random number generator. From it:

| Value                 | Derivation                                                      | Size     |
| --------------------- | --------------------------------------------------------------- | -------- |
| Group ID              | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "group-id")`    | 16 bytes |
| Content key           | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "content-key")` | 32 bytes |
| Event-key MAC key     | `HKDF-SHA256(ikm = S, salt = "tesel/v1", info = "event-key")`   | 32 bytes |
| Event key of an event | `HMAC-SHA256(eventKeyMacKey, origin ‖ seq as u32)`, truncated   | 16 bytes |

Strings are ASCII. The group ID is public; the others are secret.

### 5.1 Envelope

Events sent over the internet are sealed in an envelope:

```
envelope = nonce (12 bytes, random) ‖ AES-256-GCM(contentKey, nonce, event, aad = groupId)
```

The ciphertext includes the 16-byte GCM tag, so an envelope is at most 12 + 165 + 16 = 193 bytes. A receiver that fails to open an envelope MUST discard it silently.

Nonces are random, so a group SHOULD stay well below 2³² envelopes under one secret (the AES-GCM bound for random nonces). Key rotation is future work.

## 6. Invitations

An invitation is a URL:

```
{app-base-url}join#{token}
```

`{app-base-url}` is the URL the web app is served from, ending in `/`: `https://app.example/` or, for an app served from a sub-path, `https://tesel.eu/app/`.

In this section a **secure URL** is an `https:` URL, or an `http:` URL whose host is `localhost`, `127.0.0.1` or `[::1]` (development only; these are the origins browsers treat as secure contexts).

The token sits in the fragment so it is never sent to any server. It is the base64url encoding of:

| Size | Field     | Notes                                                                                   |
| ---- | --------- | --------------------------------------------------------------------------------------- |
| 1    | `version` | `1`                                                                                     |
| 1    | `role`    | Role granted: `0` member, `1` coordinator                                               |
| 16   | `secret`  | Group secret                                                                            |
| 4    | `issuer`  | Node ID of whoever created the invitation                                               |
| 1+n  | `name`    | text-u8, group name, 1–32 bytes                                                         |
| 1+n  | `server`  | text-u8, server base URL, 0–200 bytes; empty if none. MUST be a secure URL when present |

Decoders MUST accept only secure URLs with no query whose last path segment is exactly `join` (the path is `/join` or ends in `/join`). Servers and static hosts MUST answer that path with the web app (see [ADR-0012](decisions/0012-invitation-links-under-a-base-path.md)). A reserved `role` value grants member. Anyone holding an invitation can join the group. Interfaces MUST make clear that sharing an invitation shares the group.

## 7. Transport: MeshCore

- The group secret is written to a channel slot of the companion radio with `CMD_SET_CHANNEL`. The channel name is the group name, truncated to 31 bytes at a code-point boundary. Implementations MUST reuse a slot that already holds the secret, otherwise take the first empty slot (empty name, all-zero secret) other than slot 0, and MUST NOT overwrite any other channel.
- Each event is sent with `CMD_SEND_CHANNEL_DATA` on that channel, flood routing (`path_len = 0xFF`), `data_type = 0xFF4D`, payload = the event bytes. The radio encrypts it with the channel key.
- Inbound `RESP_CODE_CHANNEL_DATA_RECV` frames on that channel with `data_type = 0xFF4D` are decoded as events. Other `data_type` values are ignored.
- The radio encrypts channel traffic with AES-128 in ECB mode and authenticates it with a 2-byte truncated HMAC. That protects against casual listening, not against a determined attacker; see [ADR-0010](decisions/0010-lora-link-security.md).
- `0xFF4D` is in MeshCore's development range. A permanent value will be registered before the first public release; implementations SHOULD accept both during the transition.

## 8. Transport: internet

Clients connect to `v1/ws` relative to the server base URL, with the scheme changed to `wss:` (`ws:` for a loopback development server): `https://relay.example/` becomes `wss://relay.example/v1/ws`. Frames are JSON text messages; binary values are base64url strings. One connection carries one group.

**Client to server**

| Message                                             | Meaning                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `{"t": "join", "group": GROUP_ID, "after": CURSOR}` | Subscribe to a group and receive every envelope with a cursor greater than `after` (`0` for everything) |
| `{"t": "push", "key": EVENT_KEY, "env": ENVELOPE}`  | Store and relay an envelope                                                                             |

**Server to client**

| Message                                                        | Meaning                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `{"t": "env", "cursor": N, "key": EVENT_KEY, "env": ENVELOPE}` | A stored envelope; `cursor` increases per group                                                             |
| `{"t": "synced", "cursor": N}`                                 | The backlog after `after` has been sent; live envelopes follow                                              |
| `{"t": "stored", "key": EVENT_KEY}`                            | The pushed envelope is stored, now or already before                                                        |
| `{"t": "error", "code": CODE, "key": EVENT_KEY}`               | `bad-request`, `too-large`, `rate-limited` or `not-joined`; `key` is present when the error concerns a push |

- If `after` is greater than the group's last cursor, for instance because the server lost data or deleted a quiet group's envelopes, the server sends every envelope it has, then `synced` with its last cursor. Clients always adopt the cursor of `synced`.
- The server MUST store at most one envelope per `(group, key)`; a repeated push with a known key is answered with `stored` and not relayed again. Clients keep an envelope in their outbox until they receive `stored` for its key.
- The server MUST reject envelopes larger than 193 bytes with `too-large`, and envelopes smaller than 42 bytes (nonce, event header and tag) with `bad-request`.
- The server SHOULD rate-limit pushes per connection and per group, and MAY delete envelopes older than a configured retention period.
- The server never receives the group secret, the content key or plaintext events.

### 8.1 Server information

`GET healthz`, relative to the server base URL, answers a JSON object:

```json
{ "status": "ok", "protocolVersion": 1, "upstream": null, "commandPost": "https://post.example/" }
```

| Field         | Meaning                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `upstream`    | Base URL of the server this one replicates (§8.2), or `null`. Set on command posts             |
| `commandPost` | Base URL shared by the command posts of this server (§8.3), or `null`. Set on internet servers |

Both are secure URLs ending in `/` when present. Clients ignore unknown fields. The response allows any origin (`Access-Control-Allow-Origin: *`), since apps served elsewhere read it. Two server URLs are the same server when they are equal after adding a missing trailing `/` to the path.

### 8.2 Replication

A server with an `upstream` (a command post) keeps, for every group it stores or its clients join, a connection to the upstream as a client of that group. It MAY cap the number of these connections, since anyone on its network can join any group ID.

- It joins with its own cursor for the upstream, stores every `env` it receives under the message's `key` and relays it to its own clients.
- It pushes every envelope its own clients pushed, oldest first, until the upstream answers `stored`, and SHOULD stay under the upstream's rate limits.
- Storage by `(group, key)` makes replication idempotent: an envelope that comes back is not stored or relayed twice.

The command post never needs the group secret: it moves envelopes, as any server does.

### 8.3 Choosing a relay

All command posts of a server share one base URL, whose name each post resolves to itself on its own Wi-Fi. A client tries these relays for a group, in order, and moves to the next one when a connection fails before `synced`:

1. The app's own server (the one that served it), if its `upstream` is the group's server.
2. The group's server.
3. The `commandPost` of the group's server, as last learnt from its `healthz`.

Cursors belong to one relay: a client keeps one cursor per group and relay URL. Its outbox is satisfied by `stored` from any of them, since a command post replicates what it stores.

## 10. Log files

A device can save a group's log to a file and another device of the group can read it back: a backup, or a way to carry events between devices that never shared a link (a phone that worked by radio only, handing its log to the command post on a memory stick). The file is UTF-8 JSON:

```json
{
  "tesel": "log",
  "version": 1,
  "group": "<group ID, base64url>",
  "envelopes": ["<envelope, base64url>", "..."]
}
```

- `group` is the group ID (§5); a reader MUST refuse a file of another group.
- Each envelope seals one event exactly as for the internet transport (§5.1), so the file reveals no more than a relay sees: the number and size of events. Envelopes are in no particular order and may repeat events the reader has; it MUST discard those that do not open and keep the rest as if received from a relay.
- Base64url is without padding, as in invitations (§6).
- `version` is this file layout's version, separate from the protocol version. A reader MUST refuse versions it does not know.

## 9. Versioning

This document describes protocol version 1. Adding event types, symbol codes or style codes does not change the version. Version 1 is frozen with the first release, v0.1.0; until then it still changed in place (the `env` message gained `key`, and §8.1–8.3 were added, for command posts). Changing any existing layout, derivation or transport rule requires version 2, a new ADR and a migration plan.
