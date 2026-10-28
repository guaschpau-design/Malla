# 0054. Bring the group into view at start, until the user chooses a view

- Status: Accepted
- Date: 2026-10-28

## Context

The map opens on a wide view of Spain and Portugal at zoom 5, unless the address carries a view (`#map=zoom/lat/lon`, written by MapLibre after each move, so a reload or a shared link keeps it). From that wide view, members' dots overlap in one spot and this device is somewhere in it: every user first had to find themselves and zoom in. A practice, played around this device's fix or else the middle of the map, started the same way: its teammates walked a few hundred metres apart in a single pixel.

Moving the map by itself is risky. A user who has panned to look at something, pressed the locate button or opened a place from a panel must not see the map jump away when a member's position arrives. And the GPS runs only while something the user turned on uses it (ARCHITECTURE.md §3.2), so framing cannot switch it on.

## Decision

- While the map still shows the wide view it opened on, it is framed around everyone there is each time someone new appears: this device's first fix, if the GPS is on for something else, and each member with a fresh position (no older than the 10 minutes after which a dot is drawn stale). A practice's teammates are members like any other, so a practice started on the wide view is framed too. Someone already framed who moves does not move the map. The frame goes no closer than zoom 15.
- The first time the view changes by anything other than framing — a pan, a zoom, a turn, the locate button, a place shown from a panel — the user has chosen a view, and framing stops for good. A resize, which ends a "move" that leaves the view as it was, does not count.
- A view given by the address is a view chosen already: framing never starts.

The logic is `apps/web/src/lib/map/start-framing.ts`; `MapView` tells whether the address gave a view before MapLibre reads it.

## Consequences

- A user who opens the app with a group sharing positions sees the group at once, and a practice starts with its teammates in view.
- Without a fix or fresh positions the map stays on the wide view, as before.
- The view is never taken from the user: once they have moved it, only they move it. A member who appears later, on the far side of the region, is then off screen until the user looks for them.
