# Simulator

Plays a staged operation on a Tesel group: each member of the scenario is a simulated device with its own identity and its own connection to the relay, so the server treats it exactly like a phone (protocol §8). Events are real, encrypted with the group's secret.

It serves three purposes:

| Use            | How                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Demonstrations | `pnpm --filter @tesel/simulator start -- '<invitation link>'` plays the Turia scenario in real time on that group             |
| Load tests     | `syntheticOperation()` produces thousands of events of a long operation; `apps/web/e2e/catch-up.e2e.ts` feeds them to the app |
| Screenshots    | `pnpm --filter @tesel/simulator screenshots -- --app <url>/app/` takes the images of the app the site shows                   |

## Playing a scenario

Create a group in the app, open **Grupos → Invitar** and copy the link. Then:

```sh
pnpm --filter @tesel/simulator start -- 'https://tesel.eu/app/join#…' --speed 10
```

| Option        | Meaning                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `--scenario`  | Which scenario (`turia`, the default)                                                                |
| `--speed`     | Times faster than real time; `instant` sends everything at once, dated as if it had already happened |
| `--positions` | Seconds between position reports of each member (10 by default)                                      |

The relay limits pushes to three per second per device and thirty per group (`apps/server/src/relay.ts`), so `instant` suits scenarios of a few hundred events. Larger loads go through a relay of the test's own, as the catch-up test does.

## Writing a scenario

A scenario is data (`src/scenario.ts`): members, each with a route they walk back and forth (one point to stand still), and timed steps — chat, alerts, markers, shapes, SOS calls and their acknowledgements. Objects and SOS calls get an `id` that later steps refer to. `plan()` turns it into the list of events, in order, without any I/O; `play()` sends them. Add new scenarios to `src/scenarios/` and to the list in `src/scenarios/index.ts`.
