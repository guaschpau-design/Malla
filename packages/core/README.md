# @teselia/core

Application logic shared by every client, independent of the UI and of any transport: deriving the current picture from events, the LoRa airtime scheduler and the bridge rules described in [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §3.4 and §4.

Pure TypeScript. Time and randomness are passed in, never read globally, so every behaviour can be tested deterministically.

| File                | Responsibility                                                                                        | Planned |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| `ordering.ts`       | Last-writer-wins ordering of events (protocol §3.10)                                                  | Day 0   |
| `reducer.ts`        | Current state from a set of events: members, positions and chat; map objects, SOS and alerts on day 4 | Day 3–4 |
| `lora-scheduler.ts` | Priorities, airtime budget, position thinning                                                         | Day 5   |
| `bridge.ts`         | Forwarding between internet and LoRa                                                                  | Day 5–6 |

The event log and the outbox are persistence, so they live with the storage of each app (`apps/web/src/lib/events/`).
