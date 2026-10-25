# Deployment

## Web app on GitHub Pages

Every push to `main` that passes CI publishes the web app at `https://{owner}.github.io/{repository}/` (job `pages` in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

The Pages build uses the Protomaps demo base map, which is for testing only. Invitation links work under the sub-path thanks to a `404.html` fallback ([ADR-0012](../docs/decisions/0012-invitation-links-under-a-base-path.md)).

## Server on a VPS

The project's server runs at `https://teselia.eu`, on an IONOS VPS in Spain, and the GitHub Pages build proposes it for new groups.

The server runs on any Debian or Ubuntu VPS with a domain pointing to it ([ADR-0013](../docs/decisions/0013-self-updating-vps.md)).

1. Create an `A` record for the domain with the VPS's IPv4 address.
2. Log in to the VPS and run:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Malla/main/deploy/vps/install.sh \
     | sudo bash -s -- --domain teselia.example.eu
   ```

3. Use `https://teselia.example.eu` as the server when creating groups.

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

The same image runs a local command post on a laptop or Raspberry Pi (see ADR-0008); that setup arrives on day 6.
