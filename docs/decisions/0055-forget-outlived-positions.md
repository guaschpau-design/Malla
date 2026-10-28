# 0055. Forget the positions the trails have outlived

- Status: Accepted
- Date: 2026-10-28

## Context

A device kept every event of a group for ever and worked the state out again from all of them each time the group opened, on the main thread. Positions are almost all of a long operation's events: fifty members sharing every ten seconds for eight hours make 144,000. The audit of 27 October 2026 measured 3.4 s to open such a group, over 10 s under load, and the work grows with every hour of an operation.

Yet the state uses few of them. The positions slice keeps each member's latest; the trails keep each member's newest 360 after their last hiding; the journal leaves positions out (ADR-0022). Every other position changes nothing.

We weighed three ways out:

- **A snapshot of the state** plus the events after it. The state would need a stored form and a version, kept in step with every slice, and thrown away whenever one changes; it is a second record of the truth that can drift from the log, and the log goes on growing.
- **Reducing in a worker.** It frees the main thread but does the same work, and the log still grows without end.
- **Forgetting what the state can no longer use.** The work and the log stay bounded, and the state stays a function of the events kept.

## Decision

- A position is **outlived** when its member's trail can no longer take it: it is not newer than their last hiding, or the trail is full and the position is older than all of it. Later events only move a trail forward, so an outlived position stays outlived, and the state of the events kept is the state of all of them, whatever arrives later and in whatever order (`isOutlived` and `outlivedEvents` in `packages/core`, held by a test that forgets after every batch of a shuffled operation and compares).
- After every batch it applies, and over the whole log when a group opens, a device deletes the positions the state has outlived from its log and from the outbox: the newer positions that outlived them are in the outbox too. They are deleted by runs of consecutive sequence numbers, one key range each.
- A position that arrives already outlived is taken as known: not stored, applied, counted as new, passed to the server or put on the air. Copies of forgotten positions, from a relay, the radio or a log file, therefore never come back as new.
- Only positions are forgotten. Every other event is kept, deletions of objects among them (protocol §3.10).
- A log file saved by a device (protocol §10) holds what the device keeps: every event but the outlived positions. It gives any device that loads it the same state as the whole log would.

## Consequences

- A group's log holds at most 360 positions per member plus the journal. Measured in Chromium with the same log of 144,000 positions (50 members, eight hours, every ten seconds), in the conditions of the end-to-end tests, six openings each: the longest task on the main thread went from 1.1–1.5 s to 0.4–0.6 s, no longer than the app's start without the group (0.3–0.8 s); the member list showed after 4.3–6.1 s before and 3.0–4.7 s after (2.3–5.3 s without the group); the log went from 144,051 events to 18,051.
- The first opening after updating forgets an old log's outlived positions once; with that log it took 7.4 s, with a task of 1.9 s.
- `apps/web/src/lib/sync/group-feed.test.ts` keeps the log bounded and forgotten positions from coming back; the reducer test of 144,000 positions keeps the state's work linear.
- A device does not pass on positions it hears late, from the radio or a log file, once its trails have outlived them; the server may miss some of a radio-only phone's oldest positions. No device would show them.
- After a relay loses its data (ADR-0046), a device pushes again the own events it keeps, not the positions it forgot.
- A new slice that reads positions must keep to the outlived rule, which lives with the trails (`packages/core/src/state/trails.ts`), or forgetting would change its state; the test in core compares the whole state, so it would fail.
