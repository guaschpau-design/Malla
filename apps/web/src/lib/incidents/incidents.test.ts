import { stateOf } from '@teselia/core';
import type { NodeId } from '@teselia/protocol';
import { describe, expect, it } from 'vitest';

import { activeSos, cancelledSos, recentAlerts } from './incidents.ts';

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
