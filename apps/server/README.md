# @tesel/server

Stores and relays encrypted envelopes for groups ([`docs/protocol.md`](../../docs/protocol.md) §8), and serves the landing page and the web app from the same origin ([ADR-0017](../../docs/decisions/0017-server-serves-site-and-app.md)). It never sees plaintext. The same program runs on the VPS and as a command post that replicates it ([ADR-0018](../../docs/decisions/0018-command-post.md)).

Runs TypeScript directly with Node's built-in type stripping (Node 22.18 or later); there is no build step.

| Variable                           | Default                | Meaning                                                                                                                                |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TESEL_HOST`                       | `0.0.0.0`              | Interface to listen on                                                                                                                 |
| `TESEL_PORT`                       | `8080`                 | TCP port                                                                                                                               |
| `TESEL_DB`                         | `data/tesel.db`        | SQLite database file, or `:memory:`                                                                                                    |
| `TESEL_RETENTION_DAYS`             | `30`                   | Envelopes older than this are deleted, except those a command post has not uploaded yet                                                |
| `TESEL_WEB_ROOT`                   | none                   | Folder with the landing page and the built app under `app/`; the image sets it                                                         |
| `TESEL_UPSTREAM`                   | none                   | On a command post: the server it replicates (§8.2)                                                                                     |
| `TESEL_COMMAND_POST`               | none                   | On an internet server: the name of its command posts, announced to apps (§8.3)                                                         |
| `TESEL_WEATHER`                    | `ES,PT`                | Countries whose official weather warnings it gathers and serves (§8.4), or `off`                                                       |
| `TESEL_WEATHER_MAX_AGE_MINUTES`    | `70`                   | Warnings gathered longer ago than this are no longer served: gathering failed for an hour past its 10-minute interval                  |
| `TESEL_MAX_CONNECTIONS`            | `10000`                | Open WebSocket connections at most; more are refused with `503`                                                                        |
| `TESEL_MAX_CONNECTIONS_PER_IP`     | `256`                  | Open connections at most from one client address (phones behind a carrier's NAT share one)                                             |
| `TESEL_NEW_GROUPS_PER_IP_PER_HOUR` | `120`                  | Groups the server does not know that one address may join in an hour                                                                   |
| `TESEL_PUSHES_PER_SECOND`          | `500`                  | Pushes per second to the whole server, with ten seconds' worth at once; each connection gets 3 and each group 30                       |
| `TESEL_MIN_FREE_DISK_MB`           | `500`                  | Pushes are answered `unavailable` while the database's disk has no more free                                                           |
| `TESEL_TRUSTED_PROXIES`            | `loopback,uniquelocal` | Reverse proxies whose `X-Forwarded-For` names the client: addresses, ranges, or `loopback`, `linklocal`, `uniquelocal`; empty for none |

The server logs errors to standard error, never with group IDs, client addresses or secrets. Connections that do not join a group within 10 seconds are closed. The database records its schema version and is upgraded in place on start.

Restoring the database from a backup: give it a new store identity before starting the server, so that clients do not trust their cursors for the old one ([ADR-0046](../../docs/decisions/0046-store-identity.md)):

```sh
node -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('data/tesel.db').exec('UPDATE store_info SET id = randomblob(16)')"
```

| File                    | Job                                                             |
| ----------------------- | --------------------------------------------------------------- |
| `src/main.ts`           | Reads the configuration, starts everything and stops it cleanly |
| `src/app.ts`            | HTTP routes: `healthz`, the relay, weather, the web files       |
| `src/relay.ts`          | Joins, backlogs, pushes and fan-out                             |
| `src/relay-limits.ts`   | Limits on connections, new groups and pushes                    |
| `src/keyed-buckets.ts`  | Rate limits kept per group or per address                       |
| `src/disk-space.ts`     | Free space on the database's disk                               |
| `src/heartbeat.ts`      | Pings that close connections whose peer vanished                |
| `src/envelope-store.ts` | SQLite storage of envelopes, cursors and the store identity     |
| `src/store-schema.ts`   | The database schema and its upgrades                            |
| `src/replicator.ts`     | Which groups a command post links to its upstream               |
| `src/upstream-link.ts`  | One group's link to the upstream                                |
| `src/ws-text.ts`        | The relay's frame size limit and frame text                     |
| `src/web.ts`            | The landing page at `/` and the app under `/app/`               |
| `src/weather/`          | Official weather warnings from MeteoAlarm, served as §8.4       |
