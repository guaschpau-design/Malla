# 0027. Public services from the base map

- Status: Accepted
- Date: 2026-10-26

## Context

In an emergency, people look for the nearest hospital, fire station or police station, and for the town hall, where a municipality usually sets up its coordination centre. They need these places without a connection, just when they need them most. OpenStreetMap maps them, and our base map, an extract of the Protomaps daily build (ADR-0011), already carries them in its `pois` layer. The default style shows few of them, among many shops and cafés.

## Decision

- The app draws five kinds of public service from the base map's `pois` layer: health (hospitals, clinics, doctors), fire stations, police, helipads and town halls. Each kind has a round icon, so they are not confused with the group's markers, which sit on hexagons.
- They come with the base map, so they are in every downloaded area and work offline. No new data, service or server job.
- They are a map layer, «Servicios», shown by default and hidden with its switch. They appear from zoom 14, where the base map carries them.
- Tapping one opens its point under its name, with guidance there.

## Consequences

- Coverage is what OpenStreetMap has: very good in cities, patchier in villages. The app does not claim more than the map knows, such as opening hours.
- The base map does not carry pharmacies. Showing them would need our own extract from OpenStreetMap on the server; it is left for later.
