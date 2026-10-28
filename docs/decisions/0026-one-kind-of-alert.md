# 0026. The app sends one kind of alert

- Status: Accepted, amended by [0065](0065-room-for-what-is-read.md) (the chat's menu)
- Date: 2026-10-26

## Context

Coordinators could send a chat message as an alert at three levels: information, warning and critical. In an emergency, choosing between four ways of sending the same text is one decision too many, and only the critical level did something a message does not: it stays on every screen, and vibrates, until each member acknowledges it. Information and warning alerts were chat messages with a coloured edge.

## Decision

- The chat has one way to write and two ways to send: **Send**, for everyone, and **Send as alert**, for coordinators. An alert is always `ALERT` with level critical (protocol §3.9).
- Anything less than an alert is a message.
- The protocol keeps its three levels. Alerts of other levels, from other or older clients, are still shown as before.

## Consequences

- Sending an alert is one tap, and an alert always means the same thing to whoever receives it.
- There is no way to send a non-critical alert from this app. A team that wants a softer notice writes a message.
