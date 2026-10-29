import { stateOf } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { guideSteps } from './guide.ts';

const ME = 'a1a1a1a1' as NodeId;
const CARMEN = 'b2b2b2b2' as NodeId;
const MARTA = 'c3c3c3c3' as NodeId;
const NOBODY_SEEN = { teammate: false };

/** Which of the guide's steps are done, by their text. */
function done(steps: ReturnType<typeof guideSteps>, events: TeselEvent[], seen = NOBODY_SEEN) {
  const state = stateOf(events);
  return steps.filter((step) => step.done(state, ME, seen)).map((step) => step.text);
}

describe('the practice guide', () => {
  const sos: TeselEvent = {
    type: 'sos',
    origin: MARTA,
    seq: 1,
    time: 1,
    kind: 'medical',
    lat: 39.47,
    lon: -0.37,
    accuracy: null,
    text: '',
  };
  const task: TeselEvent = {
    type: 'task',
    origin: CARMEN,
    seq: 1,
    time: 1,
    task: { origin: CARMEN, seq: 1 },
    status: 'open',
    assignee: ME,
    place: null,
    text: 'Preguntar',
  };

  it('ticks off a member’s steps as they are done, in any order', () => {
    const steps = guideSteps('member', true);
    expect(done(steps, [sos, task])).toEqual([]);
    expect(
      done(
        steps,
        [
          sos,
          task,
          { type: 'ack', origin: ME, seq: 1, time: 2, target: { origin: MARTA, seq: 1 } },
          { ...task, origin: ME, seq: 2, time: 3, status: 'done' },
        ],
        { teammate: true },
      ),
    ).toEqual(['guideSeeTeammate', 'guideDoTask', 'guideAnswerSos']);
  });

  it('does not count a task the user gave themselves', () => {
    const own = { ...task, origin: ME, task: { origin: ME, seq: 1 }, status: 'done' as const };
    expect(done(guideSteps('member', true), [own])).toEqual([]);
  });

  it('asks a coordinator to sweep a search area, or else to turn on the check-in', () => {
    expect(guideSteps('coordinator', true).at(-1)?.text).toBe('guidePlanSweep');
    expect(guideSteps('coordinator', false).at(-1)?.text).toBe('guideCheckIn');
    expect(
      done(guideSteps('coordinator', false), [
        { type: 'check-in-timer', origin: ME, seq: 1, time: 1, minutes: 30 },
        { type: 'chat', origin: ME, seq: 2, time: 2, text: 'Vamos' },
        { ...task, origin: ME, seq: 3, task: { origin: ME, seq: 3 }, assignee: CARMEN },
      ]),
    ).toEqual(['guideGiveTask', 'guideTalk', 'guideCheckIn']);
  });
});
