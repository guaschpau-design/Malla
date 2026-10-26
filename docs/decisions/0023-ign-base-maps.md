# 0023. Topographic and aerial base maps from Spain's IGN, read by the browser

- Status: Accepted
- Date: 2026-10-26

## Context

In the field a street map is not enough: off-road a team needs contour lines and paths, and an aerial photograph shows what a map leaves out — buildings, tree cover, a dry riverbed. Spain's Instituto Geográfico Nacional publishes its topographic map (Mapa Topográfico Nacional) and its orthophotos (PNOA, with Sentinel-2 imagery at small scales) as open web map services under CC BY 4.0 (Orden FOM/2807/2015). Its licence asks for attribution and puts no condition on caching or downloading tiles. The services answer cross-origin requests, so a browser can read them directly. Other providers of aerial imagery forbid offline use or charge for it.

## Decision

- The map has three base maps: the street map (our OpenStreetMap vector tiles, everywhere), the IGN topographic map and the IGN orthophotos with our place names over them. The choice is a preference of the device, in the map layers panel.
- The browser reads the IGN services itself (WMTS, Web Mercator grid, JPEG tiles) through the same tile protocol as the street map, which answers from downloaded tiles first. Nothing passes through our server.
- An offline area can include either or both IGN maps, three zoom levels deeper than the street map, since raster tiles cannot be enlarged without blurring. Downloaded tiles are kept by source in the map database (version 2, which moved the street map's tiles under their source).
- Each IGN map shows the attribution its service asks for.

## Consequences

- Topographic and aerial maps cost us no hosting, and work offline where they were downloaded.
- They cover Spain only. Elsewhere the street map is the base map; European imagery (Sentinel-2) is lower in resolution and is future work (docs/hoja-de-ruta.md).
- They depend on the IGN services being up when areas are downloaded or when browsing online. A command post could proxy and cache them later if that proves a problem.
- Raster areas take several times the space of the street map; the download panel says so before downloading.
