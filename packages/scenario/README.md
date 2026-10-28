# @tesel/scenario

Staged operations as data: who takes part, where each member walks, and what they do and when (chat, alerts, markers, shapes, SOS calls, their acknowledgements and cancellations). `plan()` turns a scenario into the events to send, in time order: each member's announcement, their positions along the route and the scenario's steps. A `ScenarioPerformer` then sends them one by one: it turns each planned event into a Tesel event still without its header, which the sending device fills in, and remembers the objects and SOS calls sent so far for the steps that refer to them.

Pure TypeScript, no I/O: the same scenario always gives the same plan. Two runners send it, both through a `ScenarioPerformer`:

| Runner                                                                                               | Where the events go                                                           |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`tools/simulator`](../../tools/simulator/README.md) (`src/play.ts`)                                 | Through the relay, one simulated device per member, for demos and screenshots |
| `apps/web/src/lib/practice/practice-run.ts` ([ADR-0031](../../docs/decisions/0031-practice-mode.md)) | Straight into the practice group on the device, without leaving it            |

| File             | Responsibility                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- |
| `scenario.ts`    | The scenario model, its plan and where a member is on their route                   |
| `event-draft.ts` | The event of each planned action, and `ScenarioPerformer`, which sends them in turn |
