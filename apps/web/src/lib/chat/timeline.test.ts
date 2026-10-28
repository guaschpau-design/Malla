import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { timeline } from './timeline.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;

describe('chat timeline', () => {
  it('interleaves alerts and reports with chat lines by time', () => {
    const report = {
      place: null,
      incident: 'fire',
      hazards: [],
      access: 'unknown',
      casualties: { red: null, yellow: null, green: null, black: null },
      resources: [],
      note: 'parte',
    } as const;
    const state = stateOf([
      { type: 'chat', origin: ANA, seq: 3, time: T0 + 20, text: 'después' },
      { type: 'report', origin: ANA, seq: 4, time: T0 + 15, ...report },
      { type: 'alert', origin: ANA, seq: 2, time: T0 + 10, level: 'warning', text: 'aviso' },
      { type: 'chat', origin: ANA, seq: 1, time: T0, text: 'antes' },
    ]);
    const said = timeline(state).map((entry) => [
      entry.kind,
      entry.kind === 'report' ? entry.event.note : entry.event.text,
    ]);
    expect(said).toEqual([
      ['chat', 'antes'],
      ['alert', 'aviso'],
      ['report', 'parte'],
      ['chat', 'después'],
    ]);
  });
});
