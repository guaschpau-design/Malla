# 0007. Self-hosted vector maps for offline use

- Status: Accepted; offline-download mechanism superseded by [0011](0011-client-side-area-download.md)
- Date: 2026-10-25

## Context

Offline maps are essential: when the network fails, nobody can download tiles. The public OpenStreetMap tile servers' usage policy forbids bulk downloading, so caching their tiles for an area is not allowed. OpenStreetMap data itself is open (ODbL). The PMTiles format packs a whole vector tile set in one file that can be served as a static file and cut into regional extracts.

## Decision

- Host our own OpenStreetMap vector tiles as a PMTiles file on the project server, styled for MapLibre GL JS.
- To prepare for an incident, the app requests an extract of an area and stores it in the browser's Origin Private File System; MapLibre reads it locally with no network.
- Satellite, topographic and nautical layers are added after v0.1, each with its licence checked and recorded in a new ADR.

## Consequences

- Offline maps that respect data licences, with no third-party map service.
- The server needs disk space for the base file and CPU for generating extracts.
- Attribution to OpenStreetMap contributors is shown on the map, as the licence requires.
