# Deployment

## What the server publishes

Caddy serves the base map at `/maps/basemap.pmtiles` ([ADR-0007](../docs/decisions/0007-self-hosted-vector-maps.md)): Spain, Portugal and the islands by default; set `TESEL_MAP_BBOX` (west,south,east,north) in the environment of `maps.sh` for another area.

The server image carries the landing page ([`apps/site`](../apps/site)) at `/`, its English version at `/en/`, the web app at `/app/` and the relay at `/v1/ws` ([ADR-0017](../docs/decisions/0017-server-serves-site-and-app.md)). The app built into the image proposes its own server for new groups and uses the base map its server publishes.

GitHub Pages, where the app used to live, now only redirects to `https://tesel.eu/app/` ([`pages/`](pages)).

## Server on a VPS

The project's server runs at `https://tesel.eu`, on an IONOS VPS in Spain. It answers the project's former domain, `teselia.eu`, with a permanent redirect ([ADR-0019](../docs/decisions/0019-name-tesel.md)).

The server runs on any Debian or Ubuntu VPS with a domain pointing to it ([ADR-0013](../docs/decisions/0013-self-updating-vps.md)).

1. Create an `A` record for the domain with the VPS's IPv4 address.
2. Log in to the VPS and run:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/vps/install.sh \
     | sudo bash -s -- --domain tesel.example.eu
   ```

3. Open `https://tesel.example.eu`: the landing page is at the root and the app at `/app/`. Groups created there use that server.

What [`vps/install.sh`](vps/install.sh) sets up:

| Layer      | What                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| System     | Updates, then automatic security updates with a nightly reboot when the kernel needs it                                                             |
| Firewall   | `ufw`: only SSH (22) and the web (80, 443) are reachable                                                                                            |
| SSH        | `fail2ban` bans repeated failed logins; password logins are turned off if an SSH key is installed                                                   |
| Containers | Docker with [`vps/compose.yaml`](vps/compose.yaml): the server (read-only, no capabilities, unprivileged) and Caddy                                 |
| HTTPS      | Caddy gets and renews a Let's Encrypt certificate ([`vps/Caddyfile`](vps/Caddyfile)); no access logs are kept                                       |
| Old names  | With `--redirect-from`, domains the server used to have answer with a permanent redirect to the same address on the new one                         |
| Updates    | A systemd timer pulls `ghcr.io/guaschpau-design/tesel-server:latest` every 15 minutes and restarts what changed                                     |
| Base map   | [`vps/maps.sh`](vps/maps.sh) extracts the area from the latest Protomaps build of OpenStreetMap, served at `/maps/basemap.pmtiles`; rebuilt monthly |

CI publishes that image after every green push to `main` (job `image`), for amd64 and arm64. Running the script again applies changes to `compose.yaml` or `Caddyfile` and is otherwise harmless.

Useful commands on the VPS:

```sh
cd /opt/tesel
docker compose ps                   # what is running
docker compose logs --tail 100      # recent logs
systemctl list-timers tesel-update  # when the next update check runs
```

To announce a command post (below), run the script again with `--command-post https://puesto.example.eu`; the setting is kept on later runs.

To move the server to a new domain, point both names at the VPS and run the script with `--domain new.example.eu --redirect-from old.example.eu` (several old names go comma-separated). Links and QR codes printed with the old name keep working; the setting is kept on later runs.

A server installed while the project was called Teselia (in `/opt/teselia`) is moved by the script on its next run: it keeps the base map and the settings in `.env`, and removes the old containers, timers and stored envelopes, which were sealed with keys derived under the old name.

## Command post

The same image runs a command post on a laptop or Raspberry Pi with its own Wi-Fi, replicating the VPS: see [`command-post/`](command-post/README.md).
