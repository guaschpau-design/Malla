import type { NodeId } from '@tesel/protocol';
import { plan, ScenarioPerformer, type Scenario } from '@tesel/scenario';
import { describe, expect, it } from 'vitest';

import { SCENARIOS } from './index.ts';

describe('bundled scenarios', () => {
  it('can all be planned', () => {
    for (const scenario of SCENARIOS.values()) {
      expect(plan(scenario, { positionEvery: 10 }).length).toBeGreaterThan(scenario.steps.length);
    }
  });

  it('name only their own members, objects and teams', async () => {
    for (const scenario of SCENARIOS.values()) {
      await expect(perform(scenario)).resolves.toBeGreaterThan(0);
    }
  });
});

/** Performs every event of a scenario, as its members would send them; how many were sent. */
async function perform(scenario: Scenario): Promise<number> {
  const nodes = new Map(
    scenario.members.map((member, index) => [
      member.alias,
      String(index + 1).padStart(8, '0') as NodeId,
    ]),
  );
  const performer = new ScenarioPerformer((name) => nodes.get(name));
  let seq = 0;
  for (const event of plan(scenario, { positionEvery: 60 })) {
    const origin = nodes.get(event.by) ?? ('ffffffff' as NodeId);
    const actor = { alias: event.by, publicKey: new Uint8Array(32) };
    await performer.perform(event, actor, (draft) => {
      seq += 1;
      draft({ origin, seq, time: event.at });
      return Promise.resolve({ origin, seq });
    });
  }
  return seq;
}
