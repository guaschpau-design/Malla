# 0017. The server serves the landing page and the web app

- Status: Accepted
- Date: 2026-10-25
- Amends: [ADR-0012](0012-invitation-links-under-a-base-path.md), whose GitHub Pages deployment now only redirects

## Context

`tesel.eu` should explain the project to the general public and lead to the app, the store apps when they exist, compatible devices and how to get ready. The app was published on GitHub Pages, on another origin than the server and under the repository's name. A command post with no internet (ADR-0008) also has to serve the app to phones that join its Wi-Fi.

## Decision

- The server image carries a static landing page (`apps/site`, Spanish at `/`, English at `/en/`) and the built web app under `/app/`. One program on one origin serves the page, the app and the relay, on the VPS and on a command post alike.
- The landing page is plain HTML and CSS with no build step and no third-party requests. It reuses the app's icons under `/app/icons/`.
- The image builds the app with `TESEL_BASE=/app/` and `VITE_SERVER_URL=/`. `VITE_SERVER_URL` may be relative to the app, so every server proposes itself for new groups, whatever its domain.
- The server answers every path under `/app/` that is not a file, invitation links among them, with the app. Hashed assets are cached for good; everything else is revalidated, so releases reach phones at once.
- GitHub Pages only redirects old addresses to the same path under `https://tesel.eu/app/`, keeping the fragment so old invitations work, and replaces the old service worker with one that unregisters itself (`deploy/pages`).

## Consequences

- One deployment publishes everything; the VPS picks it up on its own (ADR-0013).
- Data stored by the app on the old origin (groups, identity) stays there: browsers keep storage per origin. Only test groups existed.
- Store apps (ADR-0016) are announced on the landing page as "coming soon" until they are published.
