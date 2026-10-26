# @tesel/core

Application logic shared by every client, independent of the UI and of any transport: deriving the current picture from events, the LoRa airtime scheduler and the bridge rules described in [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §3.4 and §4.

Pure TypeScript. Time and randomness are passed in, never read globally, so every behaviour can be tested deterministically.

| File                | Responsibility                                                                                              | Since   |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| `ordering.ts`       | Last-writer-wins ordering of events (protocol §3.10)                                                        | Day 0   |
| `reducer.ts`        | Current state from a set of events: members, positions, chat, map objects, SOS, alerts and acknowledgements | Day 3–4 |
| `lora-scheduler.ts` | Priorities, airtime budget, position thinning, SOS repeats, ACK rule and bridging to LoRa                   | Day 5   |
| `airtime.ts`        | LoRa time on air of an event                                                                                | Day 5   |
| `geo.ts`            | Distances on the Earth                                                                                      | Day 5   |

The event log and the outbox are persistence, so they live with the storage of each app (`apps/web/src/lib/events/`).

Which transport an event takes is decided where the transports meet: the group feed in `apps/web/src/lib/sync/` hands own events and events from the server to the scheduler, and events heard on LoRa to the server's outbox.
