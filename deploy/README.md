# Deployment

## Web app on GitHub Pages (until the server runs)

Every push to `main` that passes CI publishes the web app at `https://{owner}.github.io/{repository}/` (job `pages` in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

The Pages build uses the Protomaps demo base map, which is for testing only. Invitation links work under the sub-path thanks to a `404.html` fallback ([ADR-0012](../docs/decisions/0012-invitation-links-under-a-base-path.md)).

## Server on a VPS

Deployment to the project VPS is set up on day 3. The plan:

1. GitHub Actions builds a Docker image of `apps/server` with the web app's static files on every push to `main`.
2. The image is pushed to the GitHub Container Registry.
3. The VPS pulls and restarts it, behind Caddy for automatic HTTPS.

The same image runs a local command post on a laptop or Raspberry Pi (see ADR-0008).
