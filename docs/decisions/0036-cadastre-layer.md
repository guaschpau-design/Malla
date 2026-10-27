# 0036. The cadastre's parcels as one picture of the view, online only

- Status: Accepted, amended by [0037](0037-maps-across-borders.md) (France's cadastre too)
- Date: 2026-10-27

## Context

In the Spanish countryside a plot is named by its cadastral polygon and parcel ("polígono 12, parcela 345"): that is how farmers, the Guardia Civil and forest firefighters say where something is. The Dirección General del Catastro publishes its map as a free WMS (`ovc.catastro.meh.es`), in Web Mercator among other systems, with the parcels, their numbers and the polygons. Its terms give free access but forbid tiled requests and bulk downloads of portions of the map. It answers cross-origin requests, and stamps its credit on each picture.

## Decision

- "Cadastre" («Catastro») is a layer in the map layers panel, under the surroundings, off at first. It is drawn under every other overlay, on any base map.
- When the map settles at zoom 15 or closer, the app asks the WMS for one picture of the view (layer `Catastro`, EPSG:3857, at most 2048 pixels a side) and lays it over the map; the picture before stays until the next arrives, and a request still on its way is dropped when the map moves again. Further out, offline, or if the service answers with an error, there is no picture.
- It is never tiled and never downloaded for offline use, as the service's terms ask.
- Overlays can now hold a picture as well as GeoJSON features (`map/overlay.svelte.ts`).

## Consequences

- Plots can be found and named as the people of the area name them, wherever Spain's cadastre covers (not the Basque Country and Navarre, which keep their own).
- Without a connection there is no cadastre; teams that need it in the field take screenshots or the cadastre's own printouts.
- One request per view is light for the service, and for the device's data plan.
