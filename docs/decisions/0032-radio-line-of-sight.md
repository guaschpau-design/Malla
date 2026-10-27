# 0032. Radio line of sight from the terrain, sure only when it says no

- Status: Accepted, amended by [0037](0037-maps-across-borders.md) (elevation about 10 m apart, sampled every 10 m)
- Date: 2026-10-27

## Context

When the mobile network fails, the group talks over LoRa, which needs the two radios to see each other. Where to stand, or where to raise a repeater, is decided on the ground and by guesswork. The app already reads the terrain (ADR-0024), but its data is coarse: points about 30 m apart, a few metres off in height, and only the ground, not buildings or trees. A tool that promised a link and was wrong would be worse than none.

## Decision

- From any point of the map, «Visión radio» checks the straight line to another point, tapped on the map, or to this device. Each end has an antenna height: in hand (1.5 m), 5 m, 10 m or 30 m.
- The check is the one radio planning tools make: the ground sampled every 30 m (up to 30 km at that spacing), the Earth's curve under the line with the usual 4/3 radius, and 60 % of the first Fresnel zone at 869.525 MHz as the room the signal needs.
- The data's error, taken as 10 m, decides what can be said:
  - terrain more than 10 m above the line: «El terreno corta la señal», sure, with the point marked;
  - otherwise, less room than the Fresnel share plus 10 m anywhere: «Justo: puede fallar», with the point marked;
  - otherwise: «Despejada sobre el terreno», always with «sin contar edificios ni árboles».
- No link budget or range is estimated: it depends on settings and surroundings the app does not know.
- The elevation tiles are read on request even with the relief off; without a connection, the check works where the relief was downloaded and says so where it was not.

## Consequences

- The tool is sure when it says no and honest when it cannot be: the case radio planning needs most, a hill in the way, is the one it catches.
- In towns and woods a clear verdict is only a starting point; the note says why.
- The same reader and tiles as the relief: no new data, server or download.
