# 0039. Show the map's credits on opening and in the layers panel, and its scale with the controls

- Status: Accepted
- Date: 2026-10-27

## Context

MapLibre's attribution control is an «i» button in the bottom-right corner, and its scale sits in the bottom-left. Both lay over the corners where the SOS button and the dock are, and the dock was raised to leave room for them. The data's licences still ask for credit. OpenStreetMap's attribution guidelines allow it to be shown when the map opens and then collapse on the first interaction or after five seconds, as long as it can still be found, for instance in a menu.

## Decision

- The credits of the map's data are each source's attribution in the current style, plus the cadastres' while they are shown.
  - They appear in small print above the SOS button when the map opens and whenever the base map changes, until the map is moved or for five seconds.
  - They are always listed at the end of the layers panel, under "Map data".
- The scale is a line and its distance under the map's controls on the right (north, this device, layers), with the map's other instruments. It is clear of the status cards at the top, the SOS button and dock at the bottom, and the panels that open from below on a phone.
- The dock and the SOS button come down to the edge of the map.

## Consequences

- No button or box stays on the map's corners besides the app's own.
- The licences' credit is a tap away, in the panel where the maps are chosen.
