import { stateOf } from '@tesel/core';
import { encodeEvent, type NodeId, type TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { catchUpPackets, loraEventOf, standingEvents } from './lora-events.ts';

const ME = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const AT = { lat: 39.47, lon: -0.37 };

const sos = (seq: number): TeselEvent => ({
  type: 'sos',
  origin: ME,
  seq,
  time: T0,
  kind: 'medical',
  ...AT,
  accuracy: 5,
  text: '',
});

function bytesOf(event: TeselEvent): Uint8Array {
  const bytes = encodeEvent(event);
  if (!bytes.ok) throw new Error('not encodable');
  return bytes.value;
}

describe('events as the radio sees them', () => {
  const chat: TeselEvent = { type: 'chat', origin: OTHER, seq: 5, time: T0, text: 'hola' };

  it('reads the header of a type this version does not know, and nothing of a damaged event', () => {
    const unknown = bytesOf(chat);
    unknown[1] = 0x7f;
    expect(loraEventOf(unknown)).toEqual({ type: null, origin: OTHER, seq: 5, time: T0 });

    // Invalid UTF-8 in the text: a damaged copy, which must not stand in for the real chat line.
    const damaged = bytesOf(chat);
    damaged[14] = 0xff;
    expect(loraEventOf(damaged)).toBeNull();
  });

  it('gives a radio only the own SOS calls nobody else has answered', () => {
    const state = stateOf([
      sos(1),
      sos(2),
      { type: 'ack', origin: OTHER, seq: 1, time: T0, target: { origin: ME, seq: 1 } },
      { type: 'ack', origin: ME, seq: 3, time: T0, target: { origin: ME, seq: 2 } },
    ]);
    const calls = catchUpPackets(state, ME, []).filter(({ event }) => event.type === 'sos');
    expect(calls.map(({ event }) => event.seq)).toEqual([2]);
  });

  it('tells a radio the SOS calls and their cancellations', () => {
    const state = stateOf([
      sos(1),
      { type: 'sos-cancel', origin: ME, seq: 2, time: T0, sos: { origin: ME, seq: 1 } },
      { type: 'chat', origin: OTHER, seq: 1, time: T0, text: 'hola' },
    ]);
    expect(standingEvents(state).map((event) => event.type)).toEqual(['sos', 'sos-cancel']);
  });
});
