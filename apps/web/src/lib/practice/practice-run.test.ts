import { EMPTY_STATE, reduceAll } from '@tesel/core';
import { decodeEvent, generateIdentity, type TeselEvent } from '@tesel/protocol';
import type { Scenario } from '@tesel/scenario';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeRun } from './practice-run.ts';

const SCENARIO: Scenario = {
  name: 'test',
  description: 'Two members.',
  center: { lat: 39.47, lon: -0.37 },
  duration: 30,
  members: [
    { alias: 'Jordi', route: [{ lat: 39.47, lon: -0.37 }] },
    { alias: 'Carmen', route: [{ lat: 39.471, lon: -0.37 }] },
  ],
  steps: [{ at: 20, by: 'Carmen', action: { type: 'chat', text: 'Sin novedad' } }],
};

const user = generateIdentity();

/** A run whose events land in a list, decoded. */
function practice(): { run: PracticeRun; sent: TeselEvent[] } {
  const sent: TeselEvent[] = [];
  const run = new PracticeRun(
    SCENARIO,
    (bytes) => {
      const event = decodeEvent(bytes);
      if (event.ok) sent.push(event.value);
      return Promise.resolve();
    },
    { onTheWay: 'Voy' },
  );
  return { run, sent };
}

describe('practice run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays the scenario as time goes by', async () => {
    const { run, sent } = practice();
    run.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.filter((event) => event.type === 'member-info')).toHaveLength(2);
    expect(sent.some((event) => event.type === 'chat')).toBe(false);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent.find((event) => event.type === 'chat')).toMatchObject({ text: 'Sin novedad' });
    run.stop();
  });

  it('answers the user’s roll call once, one member after another', async () => {
    const { run, sent } = practice();
    run.start();
    await vi.advanceTimersByTimeAsync(0);
    const call: TeselEvent = { type: 'roll-call', origin: user.nodeId, seq: 1, time: 1, text: '' };
    const state = reduceAll(EMPTY_STATE, [...sent, call]);
    run.react(state, user.nodeId);
    run.react(state, user.nodeId);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(sent.filter((event) => event.type === 'ack')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(3_000);
    const acks = sent.filter((event) => event.type === 'ack');
    expect(acks).toHaveLength(2);
    expect(acks[0]).toMatchObject({ target: { origin: user.nodeId, seq: 1 } });
    run.stop();
  });

  it('acknowledges the user’s SOS and says someone is on the way', async () => {
    const { run, sent } = practice();
    const sos: TeselEvent = {
      type: 'sos',
      origin: user.nodeId,
      seq: 1,
      time: 1,
      kind: 'medical',
      lat: 39.47,
      lon: -0.37,
      accuracy: null,
      text: '',
    };
    run.react(reduceAll(EMPTY_STATE, [sos]), user.nodeId);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(sent.map((event) => event.type)).toEqual(['ack', 'chat']);
    run.stop();
  });
});
