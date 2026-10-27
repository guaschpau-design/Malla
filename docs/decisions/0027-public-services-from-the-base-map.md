# 0027. Public services from the base map

- Status: Accepted
- Date: 2026-10-26

## Context

In an emergency, people look for the nearest hospital, fire station or police station, and for the town hall, where a municipality usually sets up its coordination centre. They need these places without a connection, just when they need them most. OpenStreetMap maps them, and our base map, an extract of the Protomaps daily build (ADR-0011), already carries them in its `pois` layer. The default style shows few of them, among many shops and cafés.

## Decision

- The app draws seven kinds of public service from the base map's `pois` layer: health (hospitals, clinics — primary care centres among them — and doctors), pharmacies, fire stations, police, helipads, town halls and fuel stations, for vehicles and generators. Each kind has a round icon, so they are not confused with the group's markers, which sit on hexagons.
- They come with the base map, so they are in every downloaded area and work offline. No new data, service or server job.
- They are a map layer, «Servicios», shown by default and hidden with its switch. They appear from zoom 12, as the base map carries them: hospitals, fire stations and town halls from about there, the rest only in its last level, zoom 15. The app reads the base map down to that level, online and in downloaded areas (ADR-0011).
- Tapping one opens its point under its name, with guidance there.

## Consequences

- Coverage is what OpenStreetMap has: very good in cities, patchier in villages. The app does not claim more than the map knows, such as opening hours.
- Reading the base map down to zoom 15 makes the street map heavier where it is busiest: a city-centre tile weighs about three times one of zoom 14, and a download of streets detail holds four times as many tiles. A first version stopped at zoom 14 and showed only the services carried there: hospitals and most police, but few primary care centres and no pharmacies.
- The base map does not carry defibrillators, assembly points, civil protection, the Red Cross or ambulance stations; showing them would need our own extract from OpenStreetMap on the server.
