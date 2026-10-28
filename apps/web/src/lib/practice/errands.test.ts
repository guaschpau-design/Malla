import { offsetMeters, stateOf } from '@tesel/core';
import type { NodeId, ShapeEvent, SweepEvent, TaskEvent, TeamEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { doersOf, errandPoints } from './errands.ts';

const JORDI = 'a1a1a1a1' as NodeId;
const LUIS = 'b2b2b2b2' as NodeId;
const ME = 'c3c3c3c3' as NodeId;
const NORTH = 'd4d4d4d4' as NodeId;
const HERE = { lat: 39.47, lon: -0.37 };
const at = (north: number, east: number) => offsetMeters(HERE, north, east);

const AREA: ShapeEvent = {
  type: 'shape',
  origin: ME,
  seq: 1,
  time: 1,
  object: { origin: ME, seq: 1 },
  style: 2,
  label: 'Sector',
  geometry: { kind: 'polygon', points: [at(0, 0), at(0, 100), at(100, 100), at(100, 0)] },
};
const STRIP: SweepEvent = {
  type: 'sweep',
  origin: ME,
  seq: 2,
  time: 2,
  object: { origin: ME, seq: 2 },
  area: { origin: ME, seq: 1 },
  spacing: 25,
  heading: 0,
  strip: 0,
  strips: 2,
};
const TEAM: TeamEvent = {
  type: 'team',
  origin: ME,
  seq: 3,
  time: 3,
  team: NORTH,
  colour: 'blue',
  dissolved: false,
  members: [JORDI, ME],
  name: 'Norte',
};

function task(assignee: NodeId | null, place: TaskEvent['place']): TaskEvent {
  return {
    type: 'task',
    origin: ME,
    seq: 9,
    time: 9,
    task: { origin: ME, seq: 9 },
    status: 'open',
    assignee,
    place,
    text: 'Algo',
  };
}

describe('errands of simulated teammates', () => {
  const state = stateOf([AREA, STRIP, TEAM]);
  const simulated = new Set([JORDI, LUIS]);

  it('falls to the teammate it is for, or to the simulated ones of the team', () => {
    expect(doersOf(task(LUIS, null), state.teams, simulated)).toEqual([LUIS]);
    expect(doersOf(task(NORTH, null), state.teams, simulated)).toEqual([JORDI]);
    expect(doersOf(task(ME, null), state.teams, simulated)).toEqual([]);
    expect(doersOf(task(null, null), state.teams, simulated)).toEqual([]);
  });

  it('goes round an area and back to where it started', () => {
    const points = errandPoints(task(LUIS, { kind: 'object', object: AREA.object }), state.objects);
    expect(points).toHaveLength(5);
    expect(points.at(-1)).toEqual(points[0]);
  });

  it('walks a strip of a sweep lane by lane', () => {
    const points = errandPoints(
      task(LUIS, { kind: 'object', object: STRIP.object }),
      state.objects,
    );
    // Half of an area 100 m wide, in lanes 25 m apart: two lanes, each walked end to end.
    expect(points.length).toBeGreaterThanOrEqual(4);
  });

  it('goes to a point, and nowhere for a task without a place', () => {
    expect(errandPoints(task(LUIS, { kind: 'point', at: HERE }), state.objects)).toEqual([HERE]);
    expect(errandPoints(task(LUIS, null), state.objects)).toEqual([]);
  });
});
