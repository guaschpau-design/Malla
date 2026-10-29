import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { RUN_GAP_SECONDS, timeline } from './timeline.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = 'b2c3d4e5' as NodeId;
const T0 = 1_761_350_400;

const report = {
  place: null,
  incident: 'fire',
  hazards: [],
  access: 'unknown',
  casualties: { red: null, yellow: null, green: null, black: null },
  resources: [],
  note: 'parte',
} as const;

describe('chat timeline', () => {
  it('interleaves reports with chat lines by time', () => {
    const state = stateOf([
      { type: 'chat', origin: ANA, seq: 3, time: T0 + 20, text: 'después' },
      { type: 'report', origin: ANA, seq: 4, time: T0 + 15, ...report },
      { type: 'chat', origin: ANA, seq: 1, time: T0, text: 'antes' },
    ]);
    const said = timeline(state).map((entry) => [
      entry.kind,
      entry.kind === 'report' ? entry.event.note : entry.event.text,
    ]);
    expect(said).toEqual([
      ['chat', 'antes'],
      ['report', 'parte'],
      ['chat', 'después'],
    ]);
  });

  it('runs one person’s lines together, under one name, until someone else speaks or time passes', () => {
    const state = stateOf([
      { type: 'chat', origin: ANA, seq: 1, time: T0, text: 'uno' },
      { type: 'chat', origin: ANA, seq: 2, time: T0 + 60, text: 'dos' },
      { type: 'chat', origin: BERTA, seq: 1, time: T0 + 70, text: 'tres' },
      { type: 'chat', origin: ANA, seq: 3, time: T0 + 80, text: 'cuatro' },
      { type: 'report', origin: ANA, seq: 4, time: T0 + 90, ...report },
      { type: 'chat', origin: ANA, seq: 5, time: T0 + 100, text: 'cinco' },
      { type: 'chat', origin: ANA, seq: 6, time: T0 + 100 + RUN_GAP_SECONDS + 1, text: 'seis' },
    ]);
    const follows = timeline(state).flatMap((entry) =>
      entry.kind === 'chat' ? [[entry.event.text, entry.follows]] : [],
    );
    expect(follows).toEqual([
      ['uno', false],
      ['dos', true],
      ['tres', false],
      ['cuatro', false],
      ['cinco', false],
      ['seis', false],
    ]);
  });
});
