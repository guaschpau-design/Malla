import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { timeline } from './timeline.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;

describe('chat timeline', () => {
  it('interleaves alerts with chat lines by time', () => {
    const state = stateOf([
      { type: 'chat', origin: ANA, seq: 3, time: T0 + 20, text: 'después' },
      { type: 'alert', origin: ANA, seq: 2, time: T0 + 10, level: 'warning', text: 'aviso' },
      { type: 'chat', origin: ANA, seq: 1, time: T0, text: 'antes' },
    ]);
    expect(timeline(state).map((entry) => [entry.kind, entry.event.text])).toEqual([
      ['chat', 'antes'],
      ['alert', 'aviso'],
      ['chat', 'después'],
    ]);
  });
});
