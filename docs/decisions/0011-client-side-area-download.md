# 0011. Download offline areas tile by tile in the browser

- Status: Accepted
- Date: 2026-10-25
- Supersedes: the offline-download mechanism of [ADR-0007](0007-self-hosted-vector-maps.md) (self-hosting the base map still stands)

## Context

ADR-0007 planned for the server to cut a PMTiles extract per area and for the browser to store that file in the Origin Private File System. Building day 1 showed a simpler path: a PMTiles archive answers HTTP range requests for single tiles, so the browser can fetch exactly the tiles of an area itself. That needs no extraction tool on the server (the server only serves one static file), and areas that overlap share tiles instead of duplicating them.

## Decision

- The base map is one PMTiles file served as a static file with range requests.
- To download an area, the web app lists every tile from zoom 0 to the chosen zoom (at most 15), fetches them from the archive and stores them in IndexedDB. Each tile records which areas need it; deleting an area only removes tiles no other area uses.
- MapLibre gets tiles through a custom `tesel-tiles://` protocol that answers from IndexedDB first and from the network second, and returns an empty tile when both fail.
- The style's source maximum zoom is 15, the last level of the Protomaps builds; MapLibre over-zooms beyond it, so downloaded areas look the same online and offline. (It was 14 until 2026-10-27, which left out the points of interest the builds carry only at 15, pharmacies among them: ADR-0027.)
- Glyphs (a European subset) and sprites are vendored in the app and precached by the service worker.
- One area is capped at 20,000 tiles to protect the user's storage and data plan.

## Consequences

- The server stays trivial: static files only, no map tooling or CPU cost per download.
- Downloads are many small requests rather than one file; with six in parallel this is acceptable for areas up to a few hundred square kilometres at street detail.
- Until our server is running, development uses the Protomaps demo archive, which is for testing only.
- An end-to-end test with a synthetic basemap (`apps/web/e2e`) proves the offline path in a real browser.
