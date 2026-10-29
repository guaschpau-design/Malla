import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { fromOthers } from './unread.ts';

const ME = 'a1b2c3d4' as NodeId;
const ANA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

describe('what is new in the chat', () => {
  const state = stateOf([
    { type: 'chat', origin: ANA, seq: 1, time: T0, text: 'Hola' },
    { type: 'chat', origin: ME, seq: 1, time: T0 + 1, text: 'Hola, Ana' },
    // Stamped before the rest by a clock that runs late: new all the same.
    { type: 'chat', origin: ANA, seq: 2, time: T0 - 600, text: '¿Dónde estás?' },
  ]);

  it('counts the lines of others, never one’s own, whatever their time', () => {
    expect(fromOthers(state, ME)).toBe(2);
  });
});
