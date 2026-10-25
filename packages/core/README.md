# @malla/core

Application logic shared by every client, independent of the UI and of any transport: deriving the current picture from the event log, the outbox, the LoRa airtime scheduler and the bridge rules described in [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §3.4 and §4.

Pure TypeScript. Time and randomness are passed in, never read globally, so every behaviour can be tested deterministically.

| File                | Responsibility                                       | Planned |
| ------------------- | ---------------------------------------------------- | ------- |
| `ordering.ts`       | Last-writer-wins ordering of events (protocol §3.10) | Day 0   |
| `reducer.ts`        | Current state from a set of events                   | Day 3–4 |
| `outbox.ts`         | Pending events per transport, retries                | Day 3   |
| `lora-scheduler.ts` | Priorities, airtime budget, position thinning        | Day 5   |
| `bridge.ts`         | Forwarding between internet and LoRa                 | Day 5–6 |
