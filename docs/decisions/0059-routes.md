# 0059. Routes: drawn or read from a file, followed leg by leg, and a task's place may be an object

- Status: Accepted, amended by [0077](0077-coordinates-and-zone-files.md) (zones from files, typed points)
- Date: 2026-10-28
- Amends: [ADR-0025](0025-tasks.md) (a task's place may be an object, which the task follows)

## Context

Teams walk set ways: a path to search along, the way in to a casualty, a patrol round. They draw them, or bring them from a GPS or an app as GPX, KML or GeoJSON. A route must reach the whole group in one radio message, be handed to someone as work, and guide whoever walks it, offline too. The protocol already carries lines (`SHAPE`, §3.7) and a route style (§4.2); what it lacked was a way to say "this task is along that route".

## Decision

- A route is a `SHAPE` line with the route style: "Add" → "Route" draws it point by point, up to 25 points, the most a shape with any label carries in one radio message.
- A file of up to 5 MB can be read instead. Its longest line is kept and thinned to 25 points by Douglas–Peucker, splitting first where the line strays most and wherever two points would be too far apart for one step of a shape; the user sees how many points the file had and how far, at most, the route kept strays from it. The file is read as text, without an XML parser, in the browser.
- "Follow route" guides along it: to its start first, then point by point to its end, with the distance left, and a warning when this device is more than 50 m (or than its GPS can tell) from the route. Progress only moves forwards, and of the legs about as near the earliest is taken, so a way out and back, or zigzags up a slope, is followed leg by leg.
- `TASK.place` gains a kind: `2`, an object, by its reference in the same 8 bytes a point takes (§3.11). Versions that do not know it read it as no place. A task at any object, made with "Task here" or "Task on this route", follows the object: it is wherever the object is now and has no place once the object is deleted; the diary keeps where it was then. At the end of a route, a task of this device along it is marked done with one tap.

## Consequences

- Nothing new travels: a route is one `SHAPE`, a task on it one `TASK`, and older devices show both, the task without a place.
- 25 points do not follow every bend of a long track; the deviation shown says how well the route keeps it. A route of more is split into several by hand.
- A task at a marker now moves with it and loses its place if the marker is deleted, where it used to keep a copy of the point. One way to point at things is simpler than two, and a deleted object is usually one that no longer matters.
- Guidance is along the drawn route, not along roads or paths: routing over the map's ways is a later step of the roadmap.
