# Deployment

Deployment to the project VPS is set up on day 3. The plan:

1. GitHub Actions builds a Docker image of `apps/server` with the web app's static files on every push to `main`.
2. The image is pushed to the GitHub Container Registry.
3. The VPS pulls and restarts it, behind Caddy for automatic HTTPS.

The same image runs a local command post on a laptop or Raspberry Pi (see ADR-0008).
