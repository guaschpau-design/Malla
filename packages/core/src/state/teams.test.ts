import type { NodeId, TeamEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { stateOf } from '../reducer.ts';
import { teamOf } from './teams.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const NORTE = '5eed0001' as NodeId;
const SUR = '5eed0002' as NodeId;
const T0 = 1_761_350_400;

function team(id: NodeId, seq: number, members: NodeId[], dissolved = false): TeamEvent {
  const name = id === NORTE ? 'Norte' : 'Sur';
  return {
    type: 'team',
    origin: ANA,
    seq,
    time: T0 + seq,
    team: id,
    colour: 'blue',
    dissolved,
    members,
    name,
  };
}

describe('teams', () => {
  it('keeps the newest version of each team', () => {
    const state = stateOf([team(NORTE, 2, [ANA, BERTA]), team(NORTE, 1, [ANA])]);
    expect(state.teams.get(NORTE)?.members).toEqual([ANA, BERTA]);
  });

  it('puts a member in the newest team that lists them, and in none once it is dissolved', () => {
    const state = stateOf([team(NORTE, 1, [ANA, BERTA]), team(SUR, 2, [BERTA])]);
    expect(teamOf(state.teams, BERTA)?.team).toBe(SUR);
    expect(teamOf(state.teams, ANA)?.team).toBe(NORTE);
    const dissolved = stateOf([team(NORTE, 1, [ANA]), team(NORTE, 3, [ANA], true)]);
    expect(teamOf(dissolved.teams, ANA)).toBeNull();
  });
});
