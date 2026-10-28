# 0060. Sweeps: parallel lanes over a search area, one strip per team, sent as a recipe

- Status: Accepted
- Date: 2026-10-28

## Context

Searching an area on foot is done in lanes: searchers walk side by side, as far apart as they can see through the ground (some 25 m in open ground, 10 m in scrub, 5 m in dense forest), and the area is split among teams. A coordinator plans it on the map, each team must know its lanes and walk them, and the coordinator must see how far each has got and when the area is done. Over the radio, every event must fit in one message, and the lanes of an area can run to hundreds of points.

## Decision

- Only parallel lanes, the pattern used on land; expanding squares and other patterns are left out.
- A new event type, `SWEEP` (docs/protocol.md §3.13), is one strip of a sweep and a map object (§3.10). It carries the recipe, not the lanes: the area's reference, the spacing, the lanes' heading and which strip of how many. Every device works out the same lanes from it and the area (`@tesel/core`'s `sweep.ts`, following the steps the spec sets out). A strip is 36 bytes.
- Only whoever coordinates plans a sweep, on an area styled "search area, assigned": terrain presets of 25, 10 and 5 m (or any spacing from 2 to 200 m), the number of teams, the lanes' direction (along the area's longest way, turned 45° at a time), and who leads each team. The strips show on the map as they would be before they are created.
- Each strip is handed out as a task at it (a `TASK` whose place is the strip, ADR-0059), so the task list, its notices and the diary work as for any task. "Follow strip" guides along the strip's lanes, one after another, as a route.
- How much of a strip is swept is worked out on each device from the trail of whoever walks it: the part of the lanes within half the spacing of the trail. Nothing more is sent.
- When every strip is done, the device that finished the last one marks the area "search area, cleared" by sending the area again with that style, so older devices see it too.
- Removing a sweep deletes its strips and cancels the tasks left on them.

## Consequences

- One `SWEEP` and one `TASK` per team: a sweep for three teams is six short events over the radio.
- Devices that do not know `SWEEP` keep and pass it on (§3.1) and show the tasks without a place; the cleared area reaches them as an ordinary shape.
- The lanes depend on the area: changing the area moves them. The planner draws on the area as it is; replanning means removing the sweep and planning it again.
- How much is swept is an estimate: positions arrive a minute or so apart and the GPS strays a few metres, so a lane can count as walked next to the one walked. It tells the coordinator where a team is in its strip, not proof of search.
