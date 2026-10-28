import { stateOf } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { nameOf } from '../members/alias.ts';
import { myPendingCount, pendingFor, taskList } from '../tasks/tasks.ts';
import { activeTeams, isFor, newTeamId, nextColour } from './teams.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const NORTE = '5eed0001' as NodeId;
const T0 = 1_761_350_400;

const NORTE_TEAM: TeselEvent = {
  type: 'team',
  origin: ANA,
  seq: 1,
  time: T0,
  team: NORTE,
  colour: 'blue',
  dissolved: false,
  members: [BERTA],
  name: 'Norte',
};

const TEAM_TASK: TeselEvent = {
  type: 'task',
  origin: ANA,
  seq: 2,
  time: T0 + 1,
  task: { origin: ANA, seq: 2 },
  status: 'open',
  assignee: NORTE,
  place: null,
  text: 'Revisar el barranco',
};

describe('teams', () => {
  it('makes a task for a team the task of each of its members', () => {
    const state = stateOf([NORTE_TEAM, TEAM_TASK]);
    expect(isFor(NORTE, BERTA, state.teams)).toBe(true);
    expect(isFor(NORTE, ANA, state.teams)).toBe(false);
    expect(myPendingCount(state, BERTA)).toBe(1);
    expect(myPendingCount(state, ANA)).toBe(0);
    expect(pendingFor(state, BERTA, ANA).map((row) => row.fields.text)).toEqual([
      'Revisar el barranco',
    ]);
    const [row] = taskList(state, ANA).pending;
    expect(row?.assigneeName).toBe('Norte');
    expect(nameOf(state, NORTE)).toBe('Norte');
  });

  it('gives a new team the first colour free and an ID no one has', () => {
    const state = stateOf([NORTE_TEAM]);
    expect(activeTeams(state.teams).map((team) => team.name)).toEqual(['Norte']);
    expect(nextColour(state.teams)).toBe('orange');
    const id = newTeamId(state);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect([NORTE, ANA, BERTA, '00000000']).not.toContain(id);
  });
});
