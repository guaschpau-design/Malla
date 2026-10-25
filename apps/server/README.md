# @teselia/server

Stores and relays encrypted envelopes for groups ([`docs/protocol.md`](../../docs/protocol.md) §8). It never sees plaintext. The same program runs on the VPS and as a local command post ([ADR-0008](../../docs/decisions/0008-one-server-vps-and-command-post.md)).

Runs TypeScript directly with Node's built-in type stripping (Node 22.18 or later); there is no build step.

| Variable       | Default   | Meaning                |
| -------------- | --------- | ---------------------- |
| `TESELIA_HOST` | `0.0.0.0` | Interface to listen on |
| `TESELIA_PORT` | `8080`    | TCP port               |

Status: health endpoint only. The WebSocket relay arrives on day 3.
