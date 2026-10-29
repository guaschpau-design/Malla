import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { hear, NOTHING_HEARD } from '../links/heard.ts';
import { memberRows } from './member-list.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const CARLA = '630dcd29' as NodeId;
const T0 = 1_761_350_400;
const key = new Uint8Array(32);
const fix = { lat: 39.47, lon: -0.37, accuracy: 5, heading: null, speed: null };

describe('member list', () => {
  it('lists this device first, then everyone else by alias, with their position status', () => {
    const state = stateOf([
      {
        type: 'member-info',
        origin: CARLA,
        seq: 1,
        time: T0,
        role: 'member',
        publicKey: key,
        alias: 'Carla',
      },
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
      { type: 'position', origin: BERTA, seq: 2, time: T0, ...fix },
      { type: 'position-hidden', origin: CARLA, seq: 2, time: T0 },
    ]);
    expect(
      memberRows(state, CARLA, T0 + 30, NOTHING_HEARD).map((row) => [
        row.alias,
        row.self,
        row.position,
      ]),
    ).toEqual([
      ['Carla', true, 'hidden'],
      ['Ana', false, 'never'],
      ['Berta', false, 'live'],
    ]);
    expect(
      memberRows(state, CARLA, T0 + 3600, NOTHING_HEARD).find((row) => row.id === BERTA)?.position,
    ).toBe('stale');
  });

  it('marks the members this device’s radio has heard lately', () => {
    const state = stateOf([{ type: 'position', origin: BERTA, seq: 2, time: T0, ...fix }]);
    const heard = hear(NOTHING_HEARD, 'radio', [{ origin: BERTA, time: T0 }]);
    const berta = (now: number) =>
      memberRows(state, CARLA, now, heard).find((row) => row.id === BERTA)?.byRadio;
    expect(berta(T0 + 60)).toBe(true);
    expect(berta(T0 + 3600)).toBe(false);
  });

  it('marks who says a LoRa radio is linked to their app', () => {
    const state = stateOf([
      {
        type: 'member-state',
        origin: BERTA,
        seq: 3,
        time: T0,
        profile: 'volunteer',
        status: 'active',
        battery: null,
        equipment: ['water', 'lora'],
      },
      { type: 'position', origin: BERTA, seq: 2, time: T0, ...fix },
      { type: 'position', origin: CARLA, seq: 2, time: T0, ...fix },
    ]);
    const rows = memberRows(state, ANA, T0, NOTHING_HEARD);
    expect(rows.find((row) => row.id === BERTA)?.lora).toBe(true);
    expect(rows.find((row) => row.id === CARLA)?.lora).toBe(false);
  });
});
