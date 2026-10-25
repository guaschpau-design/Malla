# Deployment

## What the server publishes

The server image carries the landing page ([`apps/site`](../apps/site)) at `/`, its English version at `/en/`, the web app at `/app/` and the relay at `/v1/ws` ([ADR-0017](../docs/decisions/0017-server-serves-site-and-app.md)). The app built into the image proposes its own server for new groups.

GitHub Pages, where the app used to live, now only redirects to `https://teselia.eu/app/` ([`pages/`](pages)).

## Server on a VPS

The project's server runs at `https://teselia.eu`, on an IONOS VPS in Spain.

The server runs on any Debian or Ubuntu VPS with a domain pointing to it ([ADR-0013](../docs/decisions/0013-self-updating-vps.md)).

1. Create an `A` record for the domain with the VPS's IPv4 address.
2. Log in to the VPS and run:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Malla/main/deploy/vps/install.sh \
     | sudo bash -s -- --domain teselia.example.eu
   ```

3. Open `https://teselia.example.eu`: the landing page is at the root and the app at `/app/`. Groups created there use that server.

What [`vps/install.sh`](vps/install.sh) sets up:

| Layer      | What                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| System     | Updates, then automatic security updates with a nightly reboot when the kernel needs it                             |
| Firewall   | `ufw`: only SSH (22) and the web (80, 443) are reachable                                                            |
| SSH        | `fail2ban` bans repeated failed logins; password logins are turned off if an SSH key is installed                   |
| Containers | Docker with [`vps/compose.yaml`](vps/compose.yaml): the server (read-only, no capabilities, unprivileged) and Caddy |
| HTTPS      | Caddy gets and renews a Let's Encrypt certificate ([`vps/Caddyfile`](vps/Caddyfile)); no access logs are kept       |
| Updates    | A systemd timer pulls `ghcr.io/guaschpau-design/teselia-server:latest` every 15 minutes and restarts what changed   |

CI publishes that image after every green push to `main` (job `image`), for amd64 and arm64. Running the script again applies changes to `compose.yaml` or `Caddyfile` and is otherwise harmless.

Useful commands on the VPS:

```sh
cd /opt/teselia
docker compose ps                   # what is running
docker compose logs --tail 100      # recent logs
systemctl list-timers teselia-update  # when the next update check runs
```

To announce a command post (below), run the script again with `--command-post https://puesto.example.eu`; the setting is kept on later runs.

## Command post

The same image runs a command post on a laptop or Raspberry Pi with its own Wi-Fi, replicating the VPS: see [`command-post/`](command-post/README.md).
