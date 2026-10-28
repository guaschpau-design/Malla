import { distanceMeters, EMPTY_STATE, offsetMeters, reduceAll, type GroupState } from '@tesel/core';
import {
  decodeEvent,
  generateIdentity,
  type NodeId,
  type TaskEvent,
  type TeselEvent,
} from '@tesel/protocol';
import { WalkNetwork, YOU, type Scenario, type ScenarioStep } from '@tesel/scenario';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { translator } from '../i18n/index.ts';
import { PracticeRun } from './practice-run.ts';

const HERE = { lat: 39.47, lon: -0.37 };
const at = (north: number, east: number) => offsetMeters(HERE, north, east);
const t = translator('es');
const user = generateIdentity();

function scenario(steps: readonly ScenarioStep[] = []): Scenario {
  return {
    name: 'test',
    description: 'Two teammates.',
    center: HERE,
    duration: 600,
    members: [
      { alias: 'Jordi', route: [HERE], speed: 2 },
      { alias: 'Carmen', role: 'coordinator', route: [at(100, 0)], speed: 2 },
    ],
    steps,
  };
}

/**
 * A run whose events land in a list, decoded, with the user's own events beside them; `react`
 * shows the run the group as both make it.
 */
function practice(steps: readonly ScenarioStep[] = [], network: WalkNetwork | null = null) {
  const sent: TeselEvent[] = [];
  const own: TeselEvent[] = [];
  const run = new PracticeRun(scenario(steps), {
    sink: (bytes) => {
      const event = decodeEvent(bytes);
      if (event.ok) sent.push(event.value);
      return Promise.resolve();
    },
    self: user.nodeId,
    t,
    network,
  });
  const state = (): GroupState => reduceAll(EMPTY_STATE, [...sent, ...own]);
  const node = (alias: string): NodeId | undefined =>
    sent.find((event) => event.type === 'member-info' && event.alias === alias)?.origin;
  /** Lets `seconds` go by a second at a time, the run seeing the group change as it would. */
  async function wait(seconds: number): Promise<void> {
    for (let second = 0; second < seconds; second += 1) {
      await vi.advanceTimersByTimeAsync(1000);
      run.react(state());
    }
  }
  /** Where a teammate last said they were. */
  const lastPosition = (alias: string) => {
    const position = sent.findLast(
      (event) => event.type === 'position' && event.origin === node(alias),
    );
    return position?.type === 'position' ? { lat: position.lat, lon: position.lon } : null;
  };
  return { run, sent, own, state, node, wait, lastPosition };
}

const userEvent = (seq: number) => ({ origin: user.nodeId, seq, time: 1 });

describe('practice run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays the scenario as time goes by, and says where everyone is', async () => {
    const { run, sent, wait } = practice([
      { at: 20, by: 'Carmen', action: { type: 'chat', text: 'Sin novedad' } },
    ]);
    run.start();
    await wait(1);
    expect(sent.filter((event) => event.type === 'member-info')).toHaveLength(2);
    expect(sent.filter((event) => event.type === 'position')).toHaveLength(2);
    expect(sent.some((event) => event.type === 'chat')).toBe(false);
    await wait(20);
    expect(sent.find((event) => event.type === 'chat')).toMatchObject({ text: 'Sin novedad' });
    run.stop();
  });

  it('answers the user’s roll call once, one teammate after another', async () => {
    const { run, sent, own, wait } = practice();
    run.start();
    own.push({ ...userEvent(1), type: 'roll-call', text: '' });
    // Seen within a second, answered 4 s later.
    await wait(5);
    expect(sent.filter((event) => event.type === 'ack')).toHaveLength(1);
    await wait(3);
    const acks = sent.filter((event) => event.type === 'ack');
    expect(acks).toHaveLength(2);
    expect(acks[0]).toMatchObject({ target: { origin: user.nodeId, seq: 1 } });
    run.stop();
  });

  it('acknowledges the user’s alert', async () => {
    const { run, sent, own, wait } = practice();
    run.start();
    own.push({ ...userEvent(1), type: 'alert', level: 'critical', text: 'Evacuad' });
    await wait(8);
    expect(sent.filter((event) => event.type === 'ack')).toHaveLength(2);
    run.stop();
  });

  it('sends the nearest teammate to the user’s SOS', async () => {
    const { run, sent, own, wait, lastPosition } = practice();
    run.start();
    // Nearer Carmen, who stands 100 m north of Jordi.
    own.push({
      ...userEvent(1),
      type: 'sos',
      kind: 'medical',
      ...at(90, 0),
      accuracy: null,
      text: '',
    });
    await wait(9);
    expect(sent.filter((event) => event.type === 'ack' || event.type === 'chat')).toHaveLength(2);
    await wait(20);
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, at(90, 0))).toBeLessThan(1);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, HERE)).toBeLessThan(1);
    run.stop();
  });

  it('takes a task, walks to it, works there and says it is done', async () => {
    const { run, sent, own, node, wait, lastPosition } = practice();
    run.start();
    await wait(1);
    const jordi = node('Jordi');
    if (jordi === undefined) throw new Error('no Jordi');
    const task: TaskEvent = {
      ...userEvent(1),
      type: 'task',
      task: { origin: user.nodeId, seq: 1 },
      status: 'open',
      assignee: jordi,
      place: { kind: 'point', at: at(0, 60) },
      text: 'Revisar el portal',
    };
    own.push(task);
    await wait(7);
    expect(sent.findLast((event) => event.type === 'task')).toMatchObject({
      origin: jordi,
      status: 'in-progress',
    });
    // 60 m at 2 m/s, then 45 s of work.
    await wait(40);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(0, 60))).toBeLessThan(1);
    expect(sent.findLast((event) => event.type === 'task')).toMatchObject({
      status: 'in-progress',
    });
    await wait(40);
    expect(sent.findLast((event) => event.type === 'task')).toMatchObject({ status: 'done' });
    expect(sent.findLast((event) => event.type === 'chat')).toMatchObject({
      text: 'Hecho: Revisar el portal.',
    });
    run.stop();
  });

  it('leaves the user’s own tasks, and those for anyone, to the user', async () => {
    const { run, sent, own, wait } = practice([
      {
        at: 1,
        by: 'Carmen',
        action: { type: 'task', id: 'yours', text: 'Para ti', assignee: YOU, place: null },
      },
    ]);
    run.start();
    own.push({
      ...userEvent(1),
      type: 'task',
      task: { origin: user.nodeId, seq: 1 },
      status: 'open',
      assignee: null,
      place: null,
      text: 'Para cualquiera',
    });
    await wait(20);
    expect(sent.flatMap((event) => (event.type === 'task' ? [event.status] : []))).toEqual([
      'open',
    ]);
    run.stop();
  });

  it('sends whoever answers a teammate’s SOS to them, and ends it once they are there', async () => {
    const { run, sent, state, wait, lastPosition } = practice([
      { at: 2, by: 'Jordi', action: { type: 'sos', id: 'sos', kind: 'medical', text: 'Tobillo' } },
      { at: 5, by: 'Carmen', action: { type: 'ack', of: 'sos' } },
    ]);
    run.start();
    await wait(6);
    expect([...state().sos.values()]).toHaveLength(1);
    // 100 m at 2 m/s, then half a minute with Jordi; positions go out every 10 s.
    await wait(60);
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, HERE)).toBeLessThan(1);
    expect(state().sosCancels.size).toBe(0);
    await wait(25);
    expect(state().sosCancels.size).toBe(1);
    expect(sent.findLast((event) => event.type === 'chat')).toMatchObject({
      text: 'Ya estoy con Jordi. Está atendida.',
    });
    run.stop();
  });

  it('keeps to the streets on the way', async () => {
    // One street east from Jordi, then north to where he is sent: never across the block.
    const network = WalkNetwork.from([
      [HERE, at(0, 100), at(100, 100)],
      [at(100, 0), at(100, 100)],
    ]);
    const { run, own, node, wait, lastPosition } = practice([], network);
    run.start();
    await wait(1);
    const jordi = node('Jordi');
    if (jordi === undefined) throw new Error('no Jordi');
    own.push({
      ...userEvent(1),
      type: 'task',
      task: { origin: user.nodeId, seq: 1 },
      status: 'open',
      assignee: jordi,
      place: { kind: 'point', at: at(100, 100) },
      text: 'Ir a la esquina',
    });
    for (let second = 0; second < 110; second += 10) {
      await wait(10);
      const where = lastPosition('Jordi') ?? HERE;
      expect(distanceMeters(network?.snap(where) ?? where, where)).toBeLessThan(1);
    }
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(100, 100))).toBeLessThan(1);
    run.stop();
  });

  it('answers what the user says, but not every time', async () => {
    const { run, sent, own, wait } = practice();
    run.start();
    own.push({ ...userEvent(1), type: 'chat', text: 'Hola' });
    own.push({ ...userEvent(2), type: 'chat', text: '¿Me oís?' });
    await wait(10);
    const replies = sent.filter((event) => event.type === 'chat');
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ text: 'Recibido.' });
    run.stop();
  });
});
