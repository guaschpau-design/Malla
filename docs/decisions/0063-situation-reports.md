# 0063. Situation reports: a fixed form in one radio message, pinned in the chat

- Status: Accepted, amended by [0065](0065-room-for-what-is-read.md) (the chat's menu), [0070](0070-a-simpler-app.md) (written from Add)
- Date: 2026-10-28

## Context

On the scene, the same questions come over the radio again and again: what is happening, how many casualties and how bad, what is dangerous, can vehicles get in, what is needed. Answered in free chat they get lost among other messages and cannot be added up. Emergency services ask them in a fixed order, METHANE (major incident, exact location, type, hazards, access, number of casualties, emergency services). Over LoRa, a report must fit in one message.

## Decision

- A new event type, `REPORT` (docs/protocol.md §3.16), carries one situation report in METHANE's order: a place (as a task's: none, a point or an object), the type of incident, the hazards and the help needed as sets of bits, the access, the casualties counted by triage category (red, yellow, green, black; each may be unknown) and a short note. 20 fixed bytes and up to 131 of note. A `kind` byte leaves room for other forms later; only the situation report is defined.
- Reports are kept like chat lines, in order; a newer report does not replace an older one.
- In the app, a report is written from the chat ("Report"): only what is happening is needed; the casualties are counters, and the dangers, access and help needed are folded until opened. It goes from where this device is.
- Reports show in the chat timeline as pinned cards, in a "Reports" tab of their own with the casualties of all of them added up, on the map behind their own layer switch, and in the diary.

## Consequences

- One event per report, under 165 bytes, so it travels by radio like a chat line.
- The casualties added up count each report: two people reporting the same casualty count it twice. The tab says it is the sum of the reports, not a census.
- Other forms (damage, resources) would be new kinds of the same event, with their own layout after the kind byte.
