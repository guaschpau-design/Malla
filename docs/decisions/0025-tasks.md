# 0025. Tasks as one event type, changed by anyone, last writer wins

- Status: Accepted
- Date: 2026-10-26

## Context

Teams in the field hand out work by voice: "you two, check the barn", "someone bring water to the north gate". Writing it down in the app lets everyone see what is pending and what is done, also over radio. But every team works differently, and a task tool with mandatory fields, workflows and permissions would get in the way. A task must fit in one radio message.

## Decision

- A new event type, `TASK` (docs/protocol.md §3.11), carries the whole task: a text, a status (open, in progress, done, cancelled), an optional assignee and an optional point on the map. Only the text is required.
- A task is changed by sending the whole task again under the same task reference, exactly as map objects are (§3.10): the newest event wins. Anyone can create, take, finish, reassign or cancel any task; the diary records who did what.
- There is no delete. Cancelling hides the task from the list and keeps it in the diary.
- The place is a point. A task "at" a marker or a shape copies its position, so the task stays meaningful if the object is moved or deleted. The `place` field leaves room for other kinds later.

## Consequences

- One event per change, at most 165 bytes: tasks travel by radio like everything else, and older bridges and servers pass them on unchanged (§3.1).
- No permissions to configure; a coordinator who wants control asks the team to leave task handling to them.
- Two members changing the same task at once: the later one wins, like objects. Acceptable for short, human-sized lists.
- Due times, priorities and checklists are left out on purpose; a team that needs them writes them in the text.
