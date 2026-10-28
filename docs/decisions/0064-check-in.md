# 0064. A safety check-in that asks only when it must

- Status: Accepted
- Date: 2026-10-28

## Context

A member who falls, faints or is trapped cannot press SOS. A dead man's switch catches that: if the member shows no sign of life for a while, the device asks, and calls for help if no one answers. With many members it must not become a nuisance: no questions to someone resting, none while they are clearly busy, and nothing sent while all is well.

## Decision

- A new event type, `CHECK_IN_TIMER` (docs/protocol.md §3.17), turns the check-in on for the whole group with its minutes, or off with 0; the newest counts. Only whoever coordinates sees the switch, in the group panel, and it sets 30 minutes.
- Each device watches its own member, and only while their status is active (§3.14): any tap or key on the app, or a move of 25 m, starts the wait again. After the group's minutes without either, the phone vibrates and a card asks "Are you OK?"; any tap answers it. Two minutes unanswered send an SOS of kind general, with the last position and the text "No answer to 'Are you OK?'".
- An answer sends nothing; only a call for help travels. Time with the app off screen does not count, since a browser cannot see what the member did meanwhile.

## Consequences

- The radio carries one small event when the switch changes, and an SOS only when one is needed.
- While the app runs in a browser, the check-in works only with Tesel open on screen; the native apps will let it work with the screen off.
- A member who stays still on purpose (a long watch at one point) answers once every half hour, or sets their status to resting.
