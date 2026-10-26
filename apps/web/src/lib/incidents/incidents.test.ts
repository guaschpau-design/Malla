import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import {
  activeSos,
  cancelledSos,
  openRollCall,
  recentAlerts,
  ROLL_CALL_OPEN_S,
} from './incidents.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const key = new Uint8Array(32);
const at = { lat: 39.47, lon: -0.37, accuracy: 10 };

const state = stateOf([
  {
    type: 'member-info',
    origin: ANA,
    seq: 1,
    time: T0,
    role: 'coordinator',
    publicKey: key,
    alias: 'Ana',
  },
  {
    type: 'member-info',
    origin: BERTA,
    seq: 1,
    time: T0,
    role: 'member',
    publicKey: key,
    alias: 'Berta',
  },
  { type: 'sos', origin: BERTA, seq: 2, time: T0 + 10, kind: 'medical', ...at, text: 'Tobillo' },
  { type: 'sos', origin: BERTA, seq: 3, time: T0 + 20, kind: 'fire', ...at, text: '' },
  { type: 'ack', origin: ANA, seq: 2, time: T0 + 12, target: { origin: BERTA, seq: 2 } },
  { type: 'sos-cancel', origin: ANA, seq: 3, time: T0 + 30, sos: { origin: BERTA, seq: 3 } },
  { type: 'alert', origin: ANA, seq: 4, time: T0 + 40, level: 'critical', text: 'Evacuad' },
  { type: 'alert', origin: ANA, seq: 5, time: T0 - 4000, level: 'info', text: 'Antigua' },
  { type: 'ack', origin: BERTA, seq: 4, time: T0 + 41, target: { origin: ANA, seq: 4 } },
]);

describe('incidents', () => {
  it('lists active SOS calls with who acknowledged them', () => {
    const [call, ...others] = activeSos(state, ANA);
    expect(others).toEqual([]);
    expect(call).toMatchObject({ author: 'Berta', mine: false, by: ['Ana'], bySelf: true });
    expect(activeSos(state, BERTA)[0]).toMatchObject({ mine: true, bySelf: false });
  });

  it('says who cancelled an SOS', () => {
    expect(cancelledSos(state).map((c) => [c.author, c.cancelledBy])).toEqual([['Berta', 'Ana']]);
  });

  it('shows only recent alerts, with their acknowledgements', () => {
    const alerts = recentAlerts(state, BERTA, T0);
    expect(alerts.map((a) => [a.event.text, a.by, a.bySelf])).toEqual([
      ['Evacuad', ['Berta'], true],
    ]);
  });
});

describe('roll call', () => {
  const CARLA = '630dcd29' as NodeId;
  const call = { type: 'roll-call', origin: ANA, seq: 9, time: T0 + 100, text: '' } as const;
  const carla = {
    type: 'member-info',
    origin: CARLA,
    seq: 1,
    time: T0,
    role: 'member',
    publicKey: key,
    alias: 'Carla',
  } as const;
  const withCall = stateOf([
    ...state.journal,
    carla,
    call,
    { type: 'ack', origin: BERTA, seq: 9, time: T0 + 110, target: { origin: ANA, seq: 9 } },
  ]);

  it('tells the caller who has answered and who not yet', () => {
    expect(openRollCall(withCall, ANA, T0 + 120)).toMatchObject({
      mine: true,
      answered: ['Berta'],
      pending: ['Carla'],
    });
  });

  it('tells each member whether they have answered', () => {
    expect(openRollCall(withCall, BERTA, T0 + 120)?.answeredBySelf).toBe(true);
    expect(openRollCall(withCall, CARLA, T0 + 120)?.answeredBySelf).toBe(false);
  });

  it('closes after half an hour', () => {
    expect(openRollCall(withCall, CARLA, T0 + 100 + ROLL_CALL_OPEN_S + 1)).toBeNull();
  });
});
