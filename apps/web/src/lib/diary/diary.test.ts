import { stateOf } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { diaryLines } from './diary.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const key = new Uint8Array(32);
const object = { origin: ANA, seq: 3 };

const EVENTS: TeselEvent[] = [
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
    time: T0 + 5,
    role: 'member',
    publicKey: key,
    alias: 'Berta',
  },
  {
    type: 'position',
    origin: BERTA,
    seq: 2,
    time: T0 + 6,
    lat: 39.4,
    lon: -0.3,
    accuracy: 5,
    heading: null,
    speed: null,
  },
  {
    type: 'marker',
    origin: ANA,
    seq: 3,
    time: T0 + 10,
    object,
    symbol: 0x0003,
    lat: 39.47,
    lon: -0.37,
    label: 'Almacén',
  },
  {
    type: 'marker',
    origin: ANA,
    seq: 4,
    time: T0 + 20,
    object,
    symbol: 0x0003,
    lat: 39.47,
    lon: -0.37,
    label: 'Almacén norte',
  },
  {
    type: 'sos',
    origin: BERTA,
    seq: 3,
    time: T0 + 30,
    kind: 'medical',
    lat: 39.41,
    lon: -0.31,
    accuracy: 8,
    text: 'Tobillo',
  },
  { type: 'ack', origin: ANA, seq: 5, time: T0 + 40, target: { origin: BERTA, seq: 3 } },
  { type: 'object-delete', origin: BERTA, seq: 4, time: T0 + 50, object },
  { type: 'chat', origin: ANA, seq: 6, time: T0 + 60, text: 'Vamos' },
];

describe('the operation diary', () => {
  it('tells what happened, in order, leaving out routine positions', () => {
    const lines = diaryLines(stateOf([...EVENTS].reverse()), translator('es'));
    expect(lines.map((line) => `${line.author}: ${line.text}`)).toEqual([
      'Ana: Se une al grupo (coordinador).',
      'Berta: Se une al grupo (miembro).',
      expect.stringMatching(/^Ana: Añade .+ «Almacén»\.$/),
      expect.stringMatching(/^Ana: Cambia .+ «Almacén norte»\.$/),
      'Berta: Pide ayuda (SOS): Médica. «Tobillo»',
      'Ana: Ha recibido el SOS de Berta.',
      expect.stringMatching(/^Berta: Borra .+ «Almacén norte»\.$/),
      'Ana: «Vamos»',
    ]);
  });

  it('places what happened somewhere', () => {
    const lines = diaryLines(stateOf(EVENTS), translator('es'));
    expect(lines.find((line) => line.text.startsWith('Pide ayuda'))?.at).toEqual({
      lat: 39.41,
      lon: -0.31,
    });
  });
});
