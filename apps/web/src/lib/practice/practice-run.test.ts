import {
  distanceMeters,
  eastNorthMeters,
  EMPTY_STATE,
  offsetMeters,
  reduceAll,
  type GroupState,
} from '@tesel/core';
import {
  decodeEvent,
  eventRefKey,
  generateIdentity,
  ShapeStyleCode,
  type LatLon,
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
  /** The node ID of a teammate, once they have announced themselves. */
  const nodeOf = (alias: string): NodeId => {
    const found = node(alias);
    if (found === undefined) throw new Error(`no ${alias}`);
    return found;
  };
  /** The statuses the teammates have given tasks, with the alias of whoever gave each. */
  const statuses = () =>
    sent.flatMap((event) =>
      event.type === 'task' && event.status !== 'open'
        ? [`${aliasOfNode(event.origin)} ${event.text}: ${event.status}`]
        : [],
    );
  const aliasOfNode = (origin: NodeId) => {
    const info = sent.find((event) => event.type === 'member-info' && event.origin === origin);
    return info?.type === 'member-info' ? info.alias : '?';
  };
  return { run, sent, own, state, node, nodeOf, wait, lastPosition, statuses };
}

/** The header of the user's event number `seq`, sent now. */
const userEvent = (seq: number) => ({
  origin: user.nodeId,
  seq,
  time: Math.floor(Date.now() / 1000),
});

/** A task the user creates, or changes, as their event number `seq`. */
function userTask(
  seq: number,
  fields: Pick<TaskEvent, 'assignee' | 'place' | 'text'> & { readonly task?: number },
  status: TaskEvent['status'] = 'open',
): TaskEvent {
  const { task = seq, ...rest } = fields;
  return {
    ...userEvent(seq),
    type: 'task',
    task: { origin: user.nodeId, seq: task },
    status,
    ...rest,
  };
}

const point = (at: LatLon) => ({ kind: 'point' as const, at });

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

  it('sends whoever answers a teammate’s SOS to them, and ends it once the user has seen it', async () => {
    const { run, sent, own, state, wait, lastPosition } = practice([
      { at: 2, by: 'Jordi', action: { type: 'sos', id: 'sos', kind: 'medical', text: 'Tobillo' } },
      { at: 5, by: 'Carmen', action: { type: 'ack', of: 'sos' } },
    ]);
    run.start();
    await wait(6);
    const [sos] = state().sos.values();
    if (sos === undefined) throw new Error('no SOS');
    // 100 m at 2 m/s, then half a minute with Jordi; positions go out every 10 s.
    await wait(60);
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, HERE)).toBeLessThan(1);
    // Answering it is the user's to practise: it stays open until they have.
    await wait(120);
    expect(state().sosCancels.size).toBe(0);
    own.push({ ...userEvent(1), type: 'ack', target: { origin: sos.origin, seq: sos.seq } });
    await wait(2);
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

  it('does not answer the user’s SOS once the user has cancelled it', async () => {
    const { run, sent, own, wait } = practice();
    run.start();
    own.push({
      ...userEvent(1),
      type: 'sos',
      kind: 'medical',
      ...at(90, 0),
      accuracy: null,
      text: '',
    });
    await wait(2);
    own.push({ ...userEvent(2), type: 'sos-cancel', sos: { origin: user.nodeId, seq: 1 } });
    await wait(10);
    expect(sent.filter((event) => event.type === 'ack' || event.type === 'chat')).toEqual([]);
    run.stop();
  });

  it('takes one task at a time, and the next once through the first', async () => {
    const { run, own, nodeOf, wait, lastPosition, statuses } = practice();
    run.start();
    await wait(1);
    const jordi = nodeOf('Jordi');
    // 100 m east, then 20 m west: 50 s and 10 s away at 2 m/s.
    own.push(userTask(1, { assignee: jordi, place: point(at(0, 100)), text: 'Lejos' }));
    own.push(userTask(2, { assignee: jordi, place: point(at(0, -20)), text: 'Cerca' }));
    await wait(8);
    expect(statuses()).toEqual(['Jordi Lejos: in-progress']);
    // Taken at 7 s, reached at 57 s, done 45 s later, where it is.
    await wait(95);
    expect(statuses()).toEqual(['Jordi Lejos: in-progress', 'Jordi Lejos: done']);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(0, 100))).toBeLessThan(1);
    // Then the other: 6 s to take it, 60 s to walk there, 45 s there.
    await wait(115);
    expect(statuses().slice(2)).toEqual(['Jordi Cerca: in-progress', 'Jordi Cerca: done']);
    run.stop();
  });

  it('does a task for a team with the teammates in it', async () => {
    const { run, own, nodeOf, wait, lastPosition, statuses } = practice();
    run.start();
    await wait(1);
    const north = 'a0b0c0d0' as NodeId;
    own.push({
      ...userEvent(1),
      type: 'team',
      team: north,
      colour: 'blue',
      dissolved: false,
      members: [nodeOf('Jordi'), user.nodeId],
      name: 'Norte',
    });
    own.push(userTask(2, { assignee: north, place: point(at(0, 40)), text: 'Portal' }));
    // Taken at 7 s, reached at 27 s, done 45 s later; Carmen, in no team, stays where she is.
    await wait(75);
    expect(statuses()).toEqual(['Jordi Portal: in-progress', 'Jordi Portal: done']);
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, at(100, 0))).toBeLessThan(1);
    run.stop();
  });

  it('leaves a task in progress to whoever it is given to, who does it', async () => {
    const { run, sent, own, state, nodeOf, wait, lastPosition, statuses } = practice();
    run.start();
    await wait(1);
    own.push(userTask(1, { assignee: nodeOf('Jordi'), place: point(at(0, 60)), text: 'Ir' }));
    await wait(10);
    const taken = sent.findLast((event) => event.type === 'task');
    if (taken?.type !== 'task') throw new Error('not taken');
    // Handed to Carmen as it is, in progress.
    own.push({ ...taken, ...userEvent(2), assignee: nodeOf('Carmen') });
    await wait(1);
    const stopped = lastPosition('Jordi') ?? HERE;
    // Carmen takes it 6 s later, walks some 117 m in 58 s, and works there 45 s.
    await wait(115);
    expect(statuses()).toEqual(['Jordi Ir: in-progress', 'Carmen Ir: done']);
    expect([...state().tasks.values()][0]?.status).toBe('done');
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, at(0, 60))).toBeLessThan(1);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, stopped)).toBeLessThan(15);
    run.stop();
  });

  it('goes back to a task left to help, and is done only once through it', async () => {
    const { run, own, state, nodeOf, wait, lastPosition, statuses } = practice([
      { at: 30, by: 'Carmen', action: { type: 'sos', id: 'sos', kind: 'medical', text: '' } },
      { at: 31, by: 'Jordi', action: { type: 'ack', of: 'sos' } },
    ]);
    run.start();
    await wait(1);
    own.push(userTask(1, { assignee: nodeOf('Jordi'), place: point(at(0, 200)), text: 'Este' }));
    // Taken at 7 s; at 31 s, 48 m on, Jordi leaves it for Carmen, 100 m north of where he set off.
    await wait(40);
    const [sos] = state().sos.values();
    if (sos === undefined) throw new Error('no SOS');
    own.push({ ...userEvent(2), type: 'ack', target: { origin: sos.origin, seq: sos.seq } });
    // With her from 87 s to 117 s; then back to the task, 224 m in 112 s, and 45 s there.
    await wait(180);
    expect(state().sosCancels.size).toBe(1);
    expect(statuses()).toEqual(['Jordi Este: in-progress']);
    await wait(60);
    expect(statuses()).toEqual(['Jordi Este: in-progress', 'Jordi Este: done']);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(0, 200))).toBeLessThan(1);
    run.stop();
  });

  it('leaves a task given just before calling an SOS, and takes tasks again once it is over', async () => {
    const { run, own, state, nodeOf, wait, lastPosition, statuses } = practice([
      { at: 4, by: 'Jordi', action: { type: 'sos', id: 'sos', kind: 'medical', text: '' } },
      { at: 5, by: 'Carmen', action: { type: 'ack', of: 'sos' } },
    ]);
    run.start();
    await wait(2);
    own.push(userTask(1, { assignee: nodeOf('Jordi'), place: point(at(0, 100)), text: 'Antes' }));
    await wait(20);
    expect(statuses()).toEqual([]);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, HERE)).toBeLessThan(1);
    const [sos] = state().sos.values();
    if (sos === undefined) throw new Error('no SOS');
    own.push({ ...userEvent(2), type: 'ack', target: { origin: sos.origin, seq: sos.seq } });
    // Carmen with him from 55 s to 85 s: the SOS ends, and Jordi is well again.
    await wait(70);
    expect(state().sosCancels.size).toBe(1);
    expect(statuses()).toEqual(['Jordi Antes: in-progress']);
    run.stop();
  });

  it('sweeps a strip lane by lane across the blocks, and marks the area cleared', async () => {
    // One street, along the south edge of the area: the lanes run north across the block.
    const network = WalkNetwork.from([[at(0, -50), at(0, 150)]]);
    const { run, sent, own, state, nodeOf, wait, lastPosition, statuses } = practice([], network);
    run.start();
    await wait(1);
    const area = { origin: user.nodeId, seq: 1 };
    const strip = { origin: user.nodeId, seq: 2 };
    own.push({
      ...userEvent(1),
      type: 'shape',
      object: area,
      style: ShapeStyleCode.SEARCH_ASSIGNED,
      label: 'Sector',
      geometry: { kind: 'polygon', points: [at(10, 0), at(10, 100), at(110, 100), at(110, 0)] },
    });
    own.push({
      ...userEvent(2),
      type: 'sweep',
      object: strip,
      area,
      spacing: 50,
      heading: 0,
      strip: 0,
      strips: 1,
    });
    const place = { kind: 'object' as const, object: strip };
    own.push(userTask(3, { assignee: nodeOf('Jordi'), place, text: 'Franja' }));
    let farthest = 0;
    for (let second = 0; second < 200; second += 10) {
      await wait(10);
      const where = lastPosition('Jordi') ?? HERE;
      farthest = Math.max(farthest, eastNorthMeters(HERE, where).north);
    }
    expect(farthest).toBeGreaterThan(80);
    expect(statuses()).toEqual(['Jordi Franja: in-progress', 'Jordi Franja: done']);
    expect(state().objects.get(eventRefKey(area))).toMatchObject({
      origin: nodeOf('Jordi'),
      style: ShapeStyleCode.SEARCH_CLEARED,
    });
    expect(sent.filter((event) => event.type === 'shape')).toHaveLength(1);
    run.stop();
  });

  it('plays on past a step that cannot be played', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { run, sent, wait } = practice([
      { at: 2, by: 'Jordi', action: { type: 'ack', of: 'nothing' } },
      { at: 3, by: 'Carmen', action: { type: 'chat', text: 'Sigo aquí' } },
    ]);
    run.start();
    await wait(4);
    expect(sent.find((event) => event.type === 'chat')).toMatchObject({ text: 'Sigo aquí' });
    expect(warn).toHaveBeenCalledOnce();
    run.stop();
  });

  it('leaves nothing waiting once stopped', async () => {
    const { run, own, state, wait } = practice();
    run.start();
    await wait(1);
    run.stop();
    own.push({ ...userEvent(1), type: 'roll-call', text: '' });
    run.react(state());
    expect(vi.getTimerCount()).toBe(0);
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
