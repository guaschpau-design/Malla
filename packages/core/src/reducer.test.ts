import type { ChatEvent, MallaEvent, NodeId, PositionEvent } from '@malla/protocol';
import { describe, expect, it } from 'vitest';

import { EMPTY_STATE, reduce, stateOf } from './reducer.ts';

const ALICE = 'a1b2c3d4' as NodeId;
const BOB = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

const chat = (origin: NodeId, seq: number, time: number, text: string): ChatEvent => ({
  type: 'chat',
  origin,
  seq,
  time,
  text,
});

const position = (origin: NodeId, seq: number, time: number, lat: number): PositionEvent => ({
  type: 'position',
  origin,
  seq,
  time,
  lat,
  lon: -0.37,
  accuracy: 5,
  heading: null,
  speed: null,
});

const EVENTS: readonly MallaEvent[] = [
  {
    type: 'member-info',
    origin: ALICE,
    seq: 1,
    time: T0,
    role: 'coordinator',
    publicKey: new Uint8Array(32),
    alias: 'Ana',
  },
  {
    type: 'member-info',
    origin: BOB,
    seq: 1,
    time: T0 + 1,
    role: 'member',
    publicKey: new Uint8Array(32),
    alias: 'Berta',
  },
  {
    type: 'member-info',
    origin: BOB,
    seq: 5,
    time: T0 + 50,
    role: 'member',
    publicKey: new Uint8Array(32),
    alias: 'Berta G.',
  },
  position(ALICE, 2, T0 + 10, 39.47),
  position(ALICE, 3, T0 + 20, 39.48),
  { type: 'position-hidden', origin: ALICE, seq: 4, time: T0 + 30 },
  position(BOB, 2, T0 + 12, 39.46),
  chat(ALICE, 6, T0 + 40, 'Hola'),
  chat(BOB, 3, T0 + 40, 'Recibido'),
  chat(BOB, 4, T0 + 41, '¿Dónde?'),
];

/** Every ordering of a few events, plus a few shuffles of all of them. */
function* orderings(events: readonly MallaEvent[]): Generator<readonly MallaEvent[]> {
  yield events;
  yield [...events].reverse();
  let seed = 7;
  for (let round = 0; round < 50; round++) {
    const shuffled = [...events];
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j] as MallaEvent, shuffled[i] as MallaEvent];
    }
    yield shuffled;
  }
}

describe('group state', () => {
  it('reaches the same state whatever order the events arrive in', () => {
    const expected = stateOf(EVENTS);
    for (const ordering of orderings(EVENTS)) expect(stateOf(ordering)).toEqual(expected);
  });

  it('ignores a duplicate event delivered by a second transport', () => {
    const once = stateOf(EVENTS);
    expect(stateOf([...EVENTS, ...EVENTS])).toEqual(once);
    for (const event of EVENTS) expect(reduce(once, event)).toBe(once);
  });

  it('keeps the latest alias of each member', () => {
    const { members } = stateOf(EVENTS);
    expect(members.get(ALICE)?.alias).toBe('Ana');
    expect(members.get(BOB)?.alias).toBe('Berta G.');
  });

  it('forgets a position once the member stops sharing, even if an older one arrives late', () => {
    const late = position(ALICE, 3, T0 + 20, 39.48);
    const state = reduce(stateOf(EVENTS), late);
    expect(state.positions.get(ALICE)?.type).toBe('position-hidden');
    expect(state.positions.get(BOB)?.type).toBe('position');
  });

  it('orders chat by time, then origin, then sequence', () => {
    expect(stateOf(EVENTS).chat.map((line) => line.text)).toEqual(['Recibido', 'Hola', '¿Dónde?']);
  });

  it('starts empty', () => {
    expect(EMPTY_STATE.members.size + EMPTY_STATE.positions.size + EMPTY_STATE.chat.length).toBe(0);
  });
});
