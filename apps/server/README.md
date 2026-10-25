# @teselia/server

Stores and relays encrypted envelopes for groups ([`docs/protocol.md`](../../docs/protocol.md) §8), and serves the landing page and the web app from the same origin ([ADR-0017](../../docs/decisions/0017-server-serves-site-and-app.md)). It never sees plaintext. The same program runs on the VPS and as a command post that replicates it ([ADR-0018](../../docs/decisions/0018-command-post.md)).

Runs TypeScript directly with Node's built-in type stripping (Node 22.18 or later); there is no build step.

| Variable                 | Default           | Meaning                                                                                 |
| ------------------------ | ----------------- | --------------------------------------------------------------------------------------- |
| `TESELIA_HOST`           | `0.0.0.0`         | Interface to listen on                                                                  |
| `TESELIA_PORT`           | `8080`            | TCP port                                                                                |
| `TESELIA_DB`             | `data/teselia.db` | SQLite database file, or `:memory:`                                                     |
| `TESELIA_RETENTION_DAYS` | `30`              | Envelopes older than this are deleted, except those a command post has not uploaded yet |
| `TESELIA_WEB_ROOT`       | none              | Folder with the landing page and the built app under `app/`; the image sets it          |
| `TESELIA_UPSTREAM`       | none              | On a command post: the server it replicates (§8.2)                                      |
| `TESELIA_COMMAND_POST`   | none              | On an internet server: the name of its command posts, announced to apps (§8.3)          |

| File                    | Job                                                         |
| ----------------------- | ----------------------------------------------------------- |
| `src/main.ts`           | Reads the configuration and starts everything               |
| `src/app.ts`            | HTTP routes: `healthz`, the WebSocket relay, the web files  |
| `src/relay.ts`          | Joins, pushes, fan-out and rate limits per connection/group |
| `src/envelope-store.ts` | SQLite storage of envelopes and cursors                     |
| `src/replicator.ts`     | A command post's connections to its upstream                |
| `src/web.ts`            | The landing page at `/` and the app under `/app/`           |
