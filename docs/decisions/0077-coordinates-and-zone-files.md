# 0077. Points by their coordinates, and zones read from a file

- Status: Accepted
- Date: 2026-10-30

## Context

Coordinates are often all a team has: dictated over the radio by the 112 or another team, read from a GPS or a paper map. The app could find typed coordinates on the map (ADR-0021), but a marker, or the place of a task, could only be put there by a tap, after finding the point first. Routes could be read from a GPX, KML or GeoJSON file (ADR-0059), but zones, a search sector drawn in another program, could not.

## Decision

- While drawing a marker, a route or a zone, and while picking a task's place on the map, the tool's card has a button to **type coordinates** in place of a tap, in any format the app writes (`CoordinateEntry`, which `parseCoordinate` reads). A marker so typed is described at once; each point of a route or a zone is added as if tapped, and the map goes to it. A task's place is the point typed.
- A **zone can be read from a file** too, as a route can (`importShape`, `readShapeFile`): the largest polygon in a KML or GeoJSON file (its outer ring), or a line that closes on itself (its ends within 25 m), as a track walked round a place does; thinned to the points a shape may have, and shown to look over before finishing. Route files keep working as before; the modules are now about shapes (`shape-file.ts`, `shape-import.ts`).

This amends [ADR-0059](0059-routes.md).

## Consequences

- A point dictated over the radio goes onto the map as a marker or as a task's place without hunting for it.
- A sector planned in another program reaches the team as a zone.
- A zone's holes (a polygon's inner rings) are not kept: a zone of the app has none.
