import type { NodeId, SosEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { stateOf } from '../reducer.ts';
import { openSosCalls } from './sos.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BEA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

const call = (origin: NodeId, seq: number): SosEvent => ({
  type: 'sos',
  origin,
  seq,
  time: T0 + seq,
  kind: 'medical',
  lat: 39.47,
  lon: -0.37,
  accuracy: 5,
  text: '',
});

describe('open SOS calls', () => {
  it('are the calls no one has cancelled, whoever cancels them', () => {
    const state = stateOf([
      call(ANA, 1),
      call(BEA, 1),
      call(ANA, 2),
      { type: 'sos-cancel', origin: BEA, seq: 2, time: T0 + 3, sos: { origin: ANA, seq: 1 } },
    ]);
    expect([...openSosCalls(state)].map(([, sos]) => `${sos.origin}:${String(sos.seq)}`)).toEqual([
      `${BEA}:1`,
      `${ANA}:2`,
    ]);
  });
});
