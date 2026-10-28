# @tesel/meshcore

Connects Tesel to a MeshCore companion radio (firmware v1.18 or later, Companion BLE build) and exchanges events as channel data datagrams, as specified in [`docs/protocol.md`](../../docs/protocol.md) §7 and decided in [ADR-0006](../../docs/decisions/0006-meshcore-first-channel-datagrams.md).

The rest of the code depends only on the `RadioLink` interface in `src/radio-link.ts`, so the library underneath can be replaced without touching anything else.

| File                | Responsibility                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `radio-link.ts`     | The interface the app uses, the errors a link rejects with, and whether the browser can reach a radio: the package's light entry, `@tesel/meshcore/link`, which the app loads at start ([ADR-0053](../../docs/decisions/0053-load-heavy-parts-on-demand.md)) |
| `meshcore-radio.ts` | `RadioLink` over a MeshCore companion: one command at a time, timeouts, draining waiting messages                                                                                                                                                            |
| `channel-slot.ts`   | Which channel slot holds the group secret; channel names                                                                                                                                                                                                     |
| `companion.ts`      | The typed subset of the companion connection used here                                                                                                                                                                                                       |
| `web-ble.ts`        | Connecting over Web Bluetooth with the MIT-licensed `@liamcottle/meshcore.js`                                                                                                                                                                                |

While Tesel is connected it reads every message the radio holds. Text messages of other MeshCore apps are passed to `onText` so the app can keep and show them.
