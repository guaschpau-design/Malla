# @tesel/scenario

Staged operations as data: who takes part, where each member walks, and what they do and when (chat, alerts, markers, shapes, SOS calls and their acknowledgements). `plan()` turns a scenario into the events to send, in time order, and `eventDraft()` turns each into a Tesel event still without its header, which the sending device fills in.

Pure TypeScript, no I/O: the same scenario always gives the same plan. Two runners send it:

| Runner                                                                                | Where the events go                                                           |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`tools/simulator`](../../tools/simulator/README.md)                                  | Through the relay, one simulated device per member, for demos and screenshots |
| `apps/web/src/lib/practice/` ([ADR-0031](../../docs/decisions/0031-practice-mode.md)) | Straight into the practice group on the device, without leaving it            |

| File             | Responsibility                                                    |
| ---------------- | ----------------------------------------------------------------- |
| `scenario.ts`    | The scenario model, its plan and where a member is on their route |
| `event-draft.ts` | The event of each planned action                                  |
