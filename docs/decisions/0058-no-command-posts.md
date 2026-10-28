# 0058. Drop command posts: one server per group, radios when there is no internet

- Status: Accepted
- Date: 2026-10-28
- Supersedes: [ADR-0008](0008-one-server-vps-and-command-post.md), [ADR-0018](0018-command-post.md) and [ADR-0050](0050-post-certificates-from-the-server.md)

## Context

A command post was a laptop or Raspberry Pi with its own Wi-Fi that served the app and replicated the group's server, so that phones near it synced with no internet (ADR-0018). It took a replicator and upstream links in the server, a choice of relays and a cache of what servers said about themselves in the app, two fields of `healthz` and two sections of the protocol, an installer and an update job for the post, and a certificate the server obtained with the domain's DNS credentials and handed out with tokens (ADR-0050): over a thousand lines, the most complex part of the deployment, and the only one never tried in the field.

What it added is narrow. Where there is internet anywhere near, a phone's hotspot, a 4G router or a satellite terminal brings the group's server within reach, with nothing of Tesel's to set up. Where there is none, the radios already carry what matters, positions, SOS calls, alerts and chat, and a phone with both a radio and coverage bridges them to the server by itself (ARCHITECTURE.md §4.3). A post only helped the phones within its Wi-Fi's reach, at a base with no internet, for traffic too heavy for the radio.

## Decision

- **There are no command posts.** A group syncs with its one server, over the internet, and with its members over LoRa; a phone with both bridges them.
- The server no longer replicates another (protocol §8.2 and §8.3 removed, the weather warnings become §8.2), `healthz` says only the protocol version and the time, and the store drops what it kept for an upstream (schema version 3).
- The app connects to the group's server only, and forgets what servers said about themselves (IndexedDB version 7).
- The deployment keeps only the VPS: its installer removes the posts' certificate job, tokens and DNS credentials from a server set up with them.

## Consequences

- Fewer moving parts: one way to reach a server, nothing to install or renew in the field, no DNS credentials on the server.
- A base without internet relies on radios, whose airtime is limited: heavy traffic (many positions, long chats) reaches the base more slowly than a post's Wi-Fi would have carried it. Log files (protocol §10) still carry a phone's whole log to another by hand.
- If field use shows the need, a post can come back as its own decision, built on what the field tests teach.
