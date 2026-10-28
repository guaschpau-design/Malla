# 0048. One rule for sharing state in the web app, and panels that carry what they show

- Status: Accepted
- Date: 2026-10-28

## Context

The audit of 27 October 2026 found three ways of sharing state in apps/web, with no rule for choosing one: props passed down from `App.svelte`, a Svelte context (the elevation reader), and modules that export a reactive object (`panels`, `notices`, `navigation`, `taskEditor`, `connection`, `fullscreenView`). Panels were opened in two ways as well: `panels.open` named the panel, while what an object, member or point panel showed was kept in separate variables of `MapWorkspace.svelte`, which could disagree with it (a member panel open with the previous member's id, a point panel with no point).

## Decision

- **Props** carry everything that belongs to the session and the open group: the session, the group's feed and state, preferences, the language and `t`. They flow down from `App.svelte`. A component's props say what it depends on, and a test mounts it with them.
- **A module's reactive object** holds state that exists once on the device and does not depend on the open group: what the screen shows (the open panel, notices, the navigation target, the task being edited, full screen), and facts about the device (its connection, its clock, its location, its radio, the elevation reader while relief is on). Such a module lives in a `*.svelte.ts` file, exports one object or class instance, and changes it only through its own functions or methods.
- **Svelte contexts** are not used. The elevation reader becomes a module like the others.
- **A panel carries what it shows.** The open panel is one value of a discriminated union, `{ name: 'object', key }`, `{ name: 'member', member }`, `{ name: 'point', at }` or a plain panel name; opening a panel sets its subject in the same step, and closing it drops the subject.

## Consequences

- A newcomer can tell where a piece of state lives from what it is about.
- Nothing can show a panel with the wrong subject: the type does not allow it.
- Module state is shared by every component, including in tests; tests that change it reset it.
