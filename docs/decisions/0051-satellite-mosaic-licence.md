# 0051. Name the satellite mosaic's licence, and let a build change the mosaic

- Status: Accepted
- Date: 2026-10-27
- Amends: [ADR-0041](0041-satellite-mosaic-and-national-photos.md), whose advice for commercial deployments it replaces

## Context

The satellite map shows EOX's Sentinel-2 cloudless 2024 mosaic from afar (ADR-0041). Its licence, CC BY-NC-SA 4.0, allows non-commercial use only, and asks that the credit name the licence and link to it (§3(a)(1)(C)); the credit named EOX and Copernicus but not the licence. Tesel is open source under the EUPL, so anyone may deploy it, commercially too, and ADR-0041 only told them to edit the code. EOX's 2016 mosaic is under CC BY 4.0, which allows commercial use, and is served by the same WMTS. Its pictures are eight years older.

A tile across a border is put together on the device from the mosaic and the countries' photographs (ADR-0041). Under CC BY-NC-SA such a tile is an adaptation of the mosaic, so it may only be shared under the same licence, and not commercially.

## Decision

- The mosaic is a build-time choice, `VITE_SATELLITE_MOSAIC` (`apps/web/src/lib/config.ts`): `s2cloudless-2024`, the default, or `s2cloudless-2016` for a commercial deployment. A value the app does not know stops it, so no deployment shows a mosaic it did not choose. The default stays the 2024 mosaic, as decided in ADR-0041.
- The credit of each mosaic names its licence with a link to it, and the credit EOX asks for.
- The non-commercial condition is stated where deployments are configured: the root README and the web app's README.
- Tiles of the satellite map, downloaded or put together, stay on the device that made them. Whatever shares them beyond it — a command post that serves them, an export of an offline area — carries the mosaic's credit and licence with them, and is non-commercial while the mosaic is the 2024 one.

## Consequences

- A commercial deployment builds with one variable instead of editing the code, and its mosaic is free of the non-commercial condition.
- Anyone reading the credits learns the mosaic's licence, as it asks.
- Sharing offline tiles between devices, if it is ever built, has a licence condition to keep.
