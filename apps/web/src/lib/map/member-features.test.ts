import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { memberFeatures } from './member-features.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const CARLA = '630dcd29' as NodeId;
const T0 = 1_761_350_400;
const fix = { lat: 39.47, lon: -0.37, accuracy: 5, heading: null, speed: null };

describe('member features', () => {
  it('draws the other members who share their position, labelled with their alias', () => {
    const state = stateOf([
      {
        type: 'member-info',
        origin: BERTA,
        seq: 1,
        time: T0,
        role: 'member',
        publicKey: new Uint8Array(32),
        alias: 'Berta',
      },
      { type: 'position', origin: ANA, seq: 2, time: T0, ...fix },
      { type: 'position', origin: BERTA, seq: 2, time: T0 - 3600, ...fix },
      { type: 'position', origin: CARLA, seq: 2, time: T0, ...fix },
      { type: 'position-hidden', origin: CARLA, seq: 3, time: T0 + 1 },
    ]);
    const { features } = memberFeatures(state, ANA, T0 + 10);
    expect(features.map((f) => f.properties)).toEqual([{ label: 'Berta', stale: true }]);
    expect(features[0]?.geometry.coordinates).toEqual([-0.37, 39.47]);
  });
});
