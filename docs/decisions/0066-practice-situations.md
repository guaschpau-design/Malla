# 0066. Practice situations, on foot along the streets, with a guide

- Status: Accepted
- Date: 2026-10-28

## Context

The practice (ADR-0031) played one search with four teammates who walked straight lines between points, through buildings and across rivers, and knew nothing of what the app has gained since: member state, teams, tasks for a team, sweeps, routes, reports. The user was always the coordinator, so a volunteer never practised being given work, and nothing said what to try: the practice was a moving map to look at.

## Decision

- Starting a practice asks for a situation (a missing person, a flood, a wildfire) and the user's part: a member, whom a simulated coordinator, Carmen, forms into a team and gives a task, or the coordinator, who organises the simulated teammates. The practice group's role is that part; the group records its situation.
- The teammates keep to the streets and paths of the base map: those of its last level within 700 m, read through the same tiles the map shows, downloaded ones first. Their network keeps its largest connected part and joins lines that meet without sharing a point, as at a tile's edge. Members stand and walk on it, markers and the places of tasks are moved onto it, and drawn routes follow it, thinned to what a shape holds. Where the map has no streets (offline and nothing downloaded), they walk straight. `@tesel/scenario` holds the network and the shortest way along it (`WalkNetwork`, `onFoot`); the web app reads the lines (`map/tiles/walkways.ts`).
- The practice run moves the teammates itself, instead of following the scenario's planned positions (`plan` with no position interval), so that they act on what happens, whoever starts it: they take open tasks for them or their team, walk to them and along them (a route, an area's edge, a strip's lanes), and say when they are done, marking a sweep's area cleared if theirs was the last strip; they acknowledge roll calls and alerts; whoever acknowledges an SOS walks to it, stays a while and the SOS ends, and the nearest goes to the user's; they answer what the user says now and then, and thank the user for a task done.
- Scenarios can tell what members carry, form teams, give tasks and move them on, report, sweep and call the roll, and name the person playing them as `YOU`. The external simulator, which plays nobody's part, refuses a scenario that does.
- The practice's card guides the user through five steps, one at a time, each ticked off as soon as it is done, in any order: a member sees a teammate, talks, does the task given to them, answers an SOS and reports; a coordinator forms a team, gives a task, calls the roll, answers an SOS and plans the sweep of the search area, or turns on the check-in where there is none. The guide can be skipped.
- The line simplifier moves to `@tesel/core` and the most points a shape may have to `@tesel/protocol` (`SHAPE_MAX_POINTS`), as both the app and the scenarios use them.

This amends [ADR-0031](0031-practice-mode.md).

## Consequences

- A practice teaches the app as it is, from either side, and in two minutes: what to try is on screen.
- Teammates go where people can go. On the synthetic map of the tests they keep to its street grid; on real streets, a block may take longer to go round than it looks.
- The run reacts to the group, so a practice is never the same twice. Its behaviour is tested by itself (`practice-run.test.ts`) with time faked.
- Reading the streets takes a moment, shown on the practice's card, and a few tiles of the base map, which an offline area already holds.
