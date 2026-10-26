import {
  EVENT_TYPES,
  type ChatEvent,
  type TeselEvent,
  type NodeId,
  type PositionEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { EMPTY_STATE, HANDLED_TYPES, reduce, stateOf } from './reducer.ts';

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

const EVENTS: readonly TeselEvent[] = [
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
  {
    type: 'marker',
    origin: ALICE,
    seq: 7,
    time: T0 + 60,
    object: { origin: ALICE, seq: 7 },
    symbol: 3,
    lat: 39.47,
    lon: -0.37,
    label: 'Fuego',
  },
  {
    type: 'object-delete',
    origin: ALICE,
    seq: 8,
    time: T0 + 65,
    object: { origin: ALICE, seq: 7 },
  },
  {
    type: 'marker',
    origin: BOB,
    seq: 6,
    time: T0 + 70,
    object: { origin: ALICE, seq: 7 },
    symbol: 3,
    lat: 39.47,
    lon: -0.37,
    label: 'Fuego activo',
  },
  {
    type: 'shape',
    origin: BOB,
    seq: 7,
    time: T0 + 72,
    object: { origin: BOB, seq: 7 },
    style: 1,
    label: 'Zona',
    geometry: { kind: 'circle', center: { lat: 39.47, lon: -0.37 }, radius: 200 },
  },
  { type: 'object-delete', origin: ALICE, seq: 9, time: T0 + 75, object: { origin: BOB, seq: 7 } },
  {
    type: 'sos',
    origin: BOB,
    seq: 8,
    time: T0 + 80,
    kind: 'medical',
    lat: 39.46,
    lon: -0.37,
    accuracy: 8,
    text: 'Tobillo roto',
  },
  { type: 'ack', origin: ALICE, seq: 10, time: T0 + 82, target: { origin: BOB, seq: 8 } },
  { type: 'ack', origin: ALICE, seq: 11, time: T0 + 83, target: { origin: BOB, seq: 8 } },
  { type: 'sos-cancel', origin: BOB, seq: 9, time: T0 + 90, sos: { origin: BOB, seq: 8 } },
  { type: 'sos-cancel', origin: ALICE, seq: 12, time: T0 + 95, sos: { origin: BOB, seq: 8 } },
  {
    type: 'alert',
    origin: ALICE,
    seq: 13,
    time: T0 + 100,
    level: 'critical',
    text: 'Evacuad la zona norte',
  },
  {
    type: 'task',
    origin: BOB,
    seq: 10,
    time: T0 + 110,
    task: { origin: BOB, seq: 10 },
    status: 'open',
    assignee: ALICE,
    place: { lat: 39.47, lon: -0.38 },
    text: 'Revisar el almacén',
  },
  {
    type: 'task',
    origin: ALICE,
    seq: 14,
    time: T0 + 130,
    task: { origin: BOB, seq: 10 },
    status: 'done',
    assignee: ALICE,
    place: { lat: 39.47, lon: -0.38 },
    text: 'Revisar el almacén',
  },
  {
    type: 'task',
    origin: BOB,
    seq: 11,
    time: T0 + 120,
    task: { origin: BOB, seq: 10 },
    status: 'in-progress',
    assignee: ALICE,
    place: null,
    text: 'Revisar el almacén',
  },
];

/** Every ordering of a few events, plus a few shuffles of all of them. */
function* orderings(events: readonly TeselEvent[]): Generator<readonly TeselEvent[]> {
  yield events;
  yield [...events].reverse();
  let seed = 7;
  for (let round = 0; round < 50; round++) {
    const shuffled = [...events];
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j] as TeselEvent, shuffled[i] as TeselEvent];
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

  it('keeps the latest change of each task, whoever made it', () => {
    const task = stateOf(EVENTS).tasks.get(`${BOB}:10`);
    expect(task?.status).toBe('done');
    expect(task?.origin).toBe(ALICE);
  });

  it('orders chat by time, then origin, then sequence', () => {
    expect(stateOf(EVENTS).chat.map((line) => line.text)).toEqual(['Recibido', 'Hola', '¿Dónde?']);
  });

  it('keeps the newest edit of an object, even against an older deletion that arrives late', () => {
    const { objects } = stateOf(EVENTS);
    const fire = objects.get(`${ALICE}:7`);
    expect(fire?.type === 'marker' && fire.label).toBe('Fuego activo');
    expect(objects.get(`${BOB}:7`)?.type).toBe('object-delete');
  });

  it('records who cancelled an SOS first and who acknowledged it once', () => {
    const state = stateOf(EVENTS);
    expect(state.sos.get(`${BOB}:8`)?.kind).toBe('medical');
    expect(state.sosCancels.get(`${BOB}:8`)?.origin).toBe(BOB);
    const acks = state.acks.get(`${BOB}:8`);
    expect([...(acks?.keys() ?? [])]).toEqual([ALICE]);
    expect(acks?.get(ALICE)?.seq).toBe(10);
  });

  it('lists alerts in order', () => {
    expect(stateOf(EVENTS).alerts.map((alert) => alert.text)).toEqual(['Evacuad la zona norte']);
  });

  it('journals every event but positions, in the order every device agrees on', () => {
    const { journal } = stateOf(EVENTS);
    expect(journal).toHaveLength(EVENTS.filter((event) => event.type !== 'position').length);
    const times = journal.map((event) => event.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('starts empty', () => {
    expect(EMPTY_STATE.members.size + EMPTY_STATE.positions.size + EMPTY_STATE.chat.length).toBe(0);
  });
});

describe('slices', () => {
  it('give every event type of the protocol a place in the state', () => {
    expect([...HANDLED_TYPES].sort()).toEqual([...EVENT_TYPES].sort());
  });

  it('keep the identity of the slices an event does not touch', () => {
    const before = stateOf(EVENTS);
    const after = reduce(before, chat(BOB, 99, T0 + 500, 'later'));
    expect(after.chat).not.toBe(before.chat);
    expect(after.members).toBe(before.members);
    expect(after.objects).toBe(before.objects);
  });
});

describe('long operations', () => {
  it('rebuilds eight hours of fifty members sharing their position every ten seconds', () => {
    const members = Array.from({ length: 50 }, (_, i) => i.toString(16).padStart(8, '0') as NodeId);
    const events: TeselEvent[] = [];
    for (let round = 0; round < (8 * 3600) / 10; round++) {
      members.forEach((member, index) => {
        events.push(position(member, round + 1, T0 + 10 * round, 39.47 + index / 1000));
      });
    }
    // About half a second on a laptop. The bound only catches a slice that turns quadratic.
    const start = performance.now();
    const state = stateOf(events);
    expect(performance.now() - start).toBeLessThan(10_000);
    expect(state.positions.size).toBe(50);
  });
});
