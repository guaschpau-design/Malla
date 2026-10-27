# 0013. A self-updating VPS behind Caddy, installed by one script

- Status: Accepted; partly superseded by [0049](0049-signed-images-and-checked-updates.md) (signed images, checked updates with rollback, backups)
- Date: 2026-10-25

## Context

The project owner is not a system administrator and wants the server to be secure and easy to run. The development environment cannot open SSH connections to a server, so deployments cannot be pushed from it. The server holds only ciphertext, but it is still a machine on the internet that must not become a foothold for attackers.

## Decision

- Any Debian or Ubuntu VPS from a European provider, with a domain. The domain matters because the server URL travels inside every invitation; with a domain the VPS can be replaced without breaking groups.
- One idempotent script, `deploy/vps/install.sh`, run once by the owner: system updates and automatic security updates, `ufw` allowing only SSH and the web, `fail2ban`, password logins off when an SSH key exists, Docker, and the compose project.
- Caddy terminates HTTPS with automatic Let's Encrypt certificates and passes WebSockets to the server. It keeps no access logs.
- The server container is read-only, unprivileged, without Linux capabilities, and reachable only from Caddy.
- Deployment is **pull-based**: CI publishes `ghcr.io/{owner}/tesel-server` after every green push to `main`, and a systemd timer on the VPS pulls and restarts it every 15 minutes. Nobody needs to log in to deploy.

## Consequences

- A broken release that passes CI reaches the server within 15 minutes. CI runs unit and end-to-end tests against the real server, which is the safeguard; pinning `TESEL_IMAGE` to a commit in `/opt/tesel/.env` rolls back.
- The image must be public on GitHub Packages, or the VPS cannot pull it without credentials.
- Changes to `compose.yaml` or `Caddyfile` need the script to run again; images update alone.
- SQLite lives in a Docker volume on the VPS. Its contents are encrypted envelopes with a retention limit, so losing it costs history, not secrets; provider backups are enough for v0.1.
