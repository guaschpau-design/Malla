# 0024. Relief from the open Terrain Tiles, read by the browser

- Status: Accepted
- Date: 2026-10-26

## Context

Going somewhere in a straight line says nothing of what lies between: a ridge, a ravine, a steep slope. Teams need to see the relief on any base map and to know how much a way climbs before they take it. That needs elevation data. The Terrain Tiles open dataset (Mapzen's Terrarium tiles, hosted on AWS's open data registry) covers the world; in Europe it is built from EU-DEM (Copernicus) and SRTM, about 30 m apart. It is free to use with attribution and answers cross-origin requests.

## Decision

- Elevation comes from the Terrain Tiles in the Terrarium encoding, up to zoom 12, read by the browser through our tile protocol like every other source (ADR-0023), so it can be downloaded with an offline area.
- The relief is a choice in the map layers panel, off at first. When on, the map shades hills and valleys under the place names, and the app works out how much the straight way to a point climbs and descends and its steepest stretch, from elevations sampled every 30 m. Guidance shows it as it goes.
- Elevation tiles are decoded in the browser and kept in a small cache, since guidance asks for the same ones again as the device moves.

## Consequences

- No hosting for us, and relief anywhere in the world.
- The data is coarse (30 m) and climbs are rounded to 5 m: good for "this way crosses a ridge", not for a cliff a few metres high.
- The tiles come from a server in the United States. Building our own from Copernicus DEM, served like the base map, would keep everything in Europe; it is future work.
- Routing that avoids slopes, buildings and water is a separate, larger step (docs/hoja-de-ruta.md).
