# 0080. Told without having to look

- Status: Accepted
- Date: 2026-10-31

## Context

A walk through the app on a phone, as a new member and as a coordinator, found that what matters most was there but had to be looked for. A member joins with their position not shared (it is shared only when they choose it), and nothing tells them: the coordinator's map stays empty, and the members list showed a grey pin with no words. A member who sends an SOS with the chat open saw the chat, not the call: neither who has received it nor how to cancel it. A member who receives one saw no distance and no way there, only "Show on the map". And whoever coordinates heard of nothing unless they went to look: not when someone joined, nor of a report with casualties, nor when a task was started or finished.

## Decision

- While this device does not show itself to its group, a card on the map says so ("You are not sharing your position · The group cannot see you on the map") with one button to share it and "Not now", which leaves it until the app opens again. Sharing stays the person's choice. While sharing, the card says when the browser refuses the location, as nothing reaches the group then.
- The members list says in words who is not on the map ("not sharing position", "not sharing position yet") and who is late; only a live position keeps its pin.
- Sending an SOS closes any open panel, so the call's card is in view.
- Another member's SOS card says how far it is and which way, and has "Guide me" in place of "Show on the map"; this device's own keeps "Show on the map".
- Whoever coordinates is told in a short notice, as a member is of a task given to them, when someone joins (in one notice for those who join together), when another member sends a report (with what happens and the casualties) and when another member starts or finishes a task (`groupNews`). What happened more than five minutes ago, caught up on after a while away, is in the diary instead.

## Consequences

- A team sees itself on the map from the start, or each member knows why not.
- A coordinator follows the operation from the notices without opening each panel. In a busy operation they come often; they pass in a few seconds and never stay.
- Members are not told of reports, joins or tasks of others: those are the coordinator's to follow.
