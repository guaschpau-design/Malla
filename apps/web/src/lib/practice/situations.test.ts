import type { EventRef, NodeId, Role, TeselEvent } from '@tesel/protocol';
import { plan, ScenarioPerformer, YOU } from '@tesel/scenario';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { SITUATION_INFO, SITUATIONS } from './situations.ts';

const ME = 'f0f0f0f0' as NodeId;
const CENTRE = { lat: 39.4699, lon: -0.3763 };

/** Every event a situation's scenario sends, in order, as its teammates would send them. */
async function events(situation: (typeof SITUATIONS)[number], user: Role): Promise<TeselEvent[]> {
  const scenario = SITUATION_INFO[situation].scenario(translator('es'), CENTRE, user);
  const nodes = new Map(
    scenario.members.map((member, index) => [
      member.alias,
      `0000000${String(index + 1)}` as NodeId,
    ]),
  );
  const performer = new ScenarioPerformer((name) => (name === YOU ? ME : nodes.get(name)));
  const sent: TeselEvent[] = [];
  for (const event of plan(scenario, { positionEvery: null })) {
    const origin = nodes.get(event.by) ?? ME;
    const actor = { alias: event.by, publicKey: new Uint8Array(32) };
    await performer.perform(event, actor, (draft): Promise<EventRef> => {
      const header = { origin, seq: sent.length + 1, time: event.at };
      sent.push(draft(header));
      return Promise.resolve(header);
    });
  }
  return sent;
}

describe.each(SITUATIONS)('the %s practice', (situation) => {
  it('gives a member a task of their own, and both teams theirs', async () => {
    const sent = await events(situation, 'member');
    const tasks = sent.filter((event) => event.type === 'task');
    expect(tasks.filter((task) => task.assignee === ME)).toHaveLength(1);
    const teams = sent.filter((event) => event.type === 'team');
    expect(teams.map((team) => team.members.includes(ME))).toEqual([true, false]);
    expect(tasks.filter((task) => teams.some((team) => team.team === task.assignee))).toHaveLength(
      2,
    );
  });

  it('leaves the organising to a coordinator', async () => {
    const sent = await events(situation, 'coordinator');
    expect(sent.filter((event) => event.type === 'team' || event.type === 'task')).toEqual([]);
    expect(
      sent.find((event) => event.type === 'member-info' && event.role === 'coordinator'),
    ).toBeUndefined();
  });

  it('has a teammate call an SOS that another answers, and someone report', async () => {
    for (const user of ['member', 'coordinator'] as const) {
      const sent = await events(situation, user);
      expect(sent.filter((event) => event.type === 'sos')).toHaveLength(1);
      expect(sent.filter((event) => event.type === 'ack')).toHaveLength(1);
      expect(sent.filter((event) => event.type === 'report')).toHaveLength(1);
    }
  });
});
