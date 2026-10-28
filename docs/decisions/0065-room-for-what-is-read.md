# 0065. Give the room to what is read; what is used now and then waits in a menu

- Status: Accepted
- Date: 2026-10-28

## Context

Each feature added a button where it was used: the chat gained one for situation reports and, for coordinators, two for alerts and the roll call, under its own Send. On a phone the chat then showed three messages, under a title that repeated the dock's button and above three rows of buttons. Other panels grew the same way. In an operation the chat is read far more than any of those buttons is pressed, and a screen full of buttons asks to be learnt.

## Decision

- A panel gives its room to what is read. What is used now and then goes into a menu that opens from one button beside what it acts on (`ui/Menu.svelte`, the same menu as the dock's).
- The chat fills the height between the top bar and the dock, with its tabs as its header beside the close button. It writes in one row: a "+" menu (a new report; for coordinators, send the text as an alert and call the roll), the text with its microphone, and Send as an arrow.
- Lines of one person within five minutes of each other run under one name; one's own lines carry none. Each line ends with its time.
- A report in the chat timeline is one pinned line, with who sent it and when, that opens with a tap; the reports tab shows them open.

This amends [ADR-0026](0026-one-kind-of-alert.md), where Send as alert sat beside Send, and [ADR-0063](0063-situation-reports.md), where reports were written from a button of their own and shown open in the chat.

## Consequences

- About three times as many lines are in view on a phone, and the row that writes looks the same for everyone.
- Sending an alert and calling the roll take one tap more. Both are rare and deliberate, and the menu says what an alert does and, before any text is typed, that it needs one.
- New actions in a panel go into its menu unless they are what the panel is for.
