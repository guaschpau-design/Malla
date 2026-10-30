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
import { YOU, type ScenarioStep } from '@tesel/scenario';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { translator } from '../i18n/index.ts';
import { Chance } from './chance.ts';
import type { Exercise, Inject, Setting, World } from './exercise.ts';
import { Ground } from './ground.ts';
import { PracticeRun } from './practice-run.ts';
import type { Persona } from './teammate.ts';

const HERE = { lat: 39.47, lon: -0.37 };
const at = (north: number, east: number) => offsetMeters(HERE, north, east);
const t = translator('es');
const user = generateIdentity();

/** Nothing in the way, and nothing happening by itself. */
const CALM: World = { passable: () => () => true, tick: () => undefined };

interface Options {
  readonly steps?: readonly ScenarioStep[];
  /** Streets the teammates keep to; none, and they walk straight. */
  readonly streets?: readonly (readonly LatLon[])[];
  readonly world?: World;
  readonly injects?: readonly Inject[];
  readonly personas?: Readonly<Record<string, Persona>>;
  /** Carmen coordinates, and the user is a member; or the user coordinates. */
  readonly user?: 'member' | 'coordinator';
  readonly seconds?: number;
}

/**
 * A run of two teammates, Jordi here and Carmen 100 m north, whose events land in a list, decoded,
 * with the user's own events beside them; `wait` shows the run the group as both make it.
 */
function practice({
  steps = [],
  streets = [],
  world = CALM,
  injects = [],
  personas = {},
  user: part = 'member',
  seconds = 3600,
}: Options = {}) {
  const sent: TeselEvent[] = [];
  const own: TeselEvent[] = [];
  const ground = new Ground(
    { ways: streets.map((points) => ({ points, name: null })), waterways: [], greens: [] },
    null,
    'es',
  );
  const setting: Setting = {
    t,
    locale: 'es',
    centre: HERE,
    user: part,
    ground,
    chance: new Chance(1),
  };
  const exercise: Exercise = {
    scenario: {
      name: 'test',
      description: 'Two teammates.',
      center: HERE,
      duration: seconds,
      members: [
        { alias: 'Jordi', route: [HERE], speed: 2 },
        {
          alias: 'Carmen',
          role: part === 'member' ? 'coordinator' : 'member',
          route: [at(100, 0)],
          speed: 2,
        },
      ],
      steps,
    },
    personas,
    world,
    injects,
    seconds,
  };
  let finished = false;
  const run = new PracticeRun(exercise, {
    sink: (bytes) => {
      const event = decodeEvent(bytes);
      if (event.ok) sent.push(event.value);
      return Promise.resolve();
    },
    self: user.nodeId,
    setting,
    onfinish: () => {
      finished = true;
    },
  });
  const state = (): GroupState => reduceAll(EMPTY_STATE, [...sent, ...own]);
  const node = (alias: string): NodeId | undefined =>
    sent.find((event) => event.type === 'member-info' && event.alias === alias)?.origin;
  /** Lets `seconds` go by a second at a time, the run seeing the group change as it would. */
  async function wait(time: number): Promise<void> {
    for (let second = 0; second < time; second += 1) {
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
  const aliasOfNode = (origin: NodeId) => {
    const info = sent.find((event) => event.type === 'member-info' && event.origin === origin);
    return info?.type === 'member-info' ? info.alias : '?';
  };
  /** The statuses the teammates have given tasks, with the alias of whoever gave each. */
  const statuses = () =>
    sent.flatMap((event) =>
      event.type === 'task' && event.status !== 'open'
        ? [`${aliasOfNode(event.origin)} ${event.text}: ${event.status}`]
        : [],
    );
  /** What each teammate has said, as "Alias: text". */
  const said = () =>
    sent.flatMap((event) =>
      event.type === 'chat' ? [`${aliasOfNode(event.origin)}: ${event.text}`] : [],
    );
  return {
    run,
    sent,
    own,
    state,
    nodeOf,
    wait,
    lastPosition,
    statuses,
    said,
    finished: () => finished,
  };
}

/** The header of the user's event number `seq`, sent now. */
const userEvent = (seq: number) => ({
  origin: user.nodeId,
  seq,
  time: Math.floor(Date.now() / 1000),
});

/** A task the user creates, as their event number `seq`. */
function userTask(seq: number, fields: Pick<TaskEvent, 'assignee' | 'place' | 'text'>): TaskEvent {
  return {
    ...userEvent(seq),
    type: 'task',
    task: { origin: user.nodeId, seq },
    status: 'open',
    ...fields,
  };
}

const point = (where: LatLon) => ({ kind: 'point' as const, at: where });

/** An SOS of the user's, as their event number `seq`, at a place. */
const userSos = (seq: number, where: LatLon): TeselEvent => ({
  ...userEvent(seq),
  type: 'sos',
  kind: 'medical',
  ...where,
  accuracy: null,
  text: '',
});

describe('practice run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays the opening as time goes by, and says where everyone is', async () => {
    const { run, sent, wait } = practice({
      steps: [{ at: 20, by: 'Carmen', action: { type: 'chat', text: 'Sin novedad' } }],
    });
    run.start();
    await wait(1);
    expect(sent.filter((event) => event.type === 'member-info')).toHaveLength(2);
    expect(sent.filter((event) => event.type === 'position')).toHaveLength(2);
    expect(sent.some((event) => event.type === 'chat')).toBe(false);
    await wait(20);
    expect(sent.find((event) => event.type === 'chat')).toMatchObject({ text: 'Sin novedad' });
    run.stop();
  });

  it('sends the nearest teammate to the user’s SOS', async () => {
    const { run, sent, own, wait, lastPosition } = practice();
    run.start();
    // Nearer Carmen, who stands 100 m north of Jordi.
    own.push(userSos(1, at(90, 0)));
    await wait(9);
    expect(sent.filter((event) => event.type === 'ack' || event.type === 'chat')).toHaveLength(2);
    await wait(20);
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, at(90, 0))).toBeLessThan(1);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, HERE)).toBeLessThan(1);
    run.stop();
  });

  it('does not answer the user’s SOS once the user has cancelled it', async () => {
    const { run, sent, own, wait } = practice();
    run.start();
    own.push(userSos(1, at(90, 0)));
    await wait(2);
    own.push({ ...userEvent(2), type: 'sos-cancel', sos: { origin: user.nodeId, seq: 1 } });
    await wait(10);
    expect(sent.filter((event) => event.type === 'ack' || event.type === 'chat')).toEqual([]);
    run.stop();
  });

  it('takes a task, walks to it, works there and says it is done', async () => {
    const { run, sent, own, nodeOf, wait, lastPosition, said } = practice();
    run.start();
    await wait(1);
    own.push(
      userTask(1, {
        assignee: nodeOf('Jordi'),
        place: point(at(0, 60)),
        text: 'Revisar el portal',
      }),
    );
    await wait(7);
    expect(sent.findLast((event) => event.type === 'task')).toMatchObject({
      origin: nodeOf('Jordi'),
      status: 'in-progress',
    });
    // 60 m at 2 m/s, then 75 s of work.
    await wait(40);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(0, 60))).toBeLessThan(1);
    expect(sent.findLast((event) => event.type === 'task')).toMatchObject({
      status: 'in-progress',
    });
    await wait(70);
    expect(sent.findLast((event) => event.type === 'task')).toMatchObject({ status: 'done' });
    expect(said().at(-1)).toMatch(/^Jordi: .*Revisar el portal/);
    run.stop();
  });

  it('leaves the user’s own tasks, and those for anyone, to the user', async () => {
    const { run, sent, own, wait } = practice({
      steps: [
        {
          at: 1,
          by: 'Carmen',
          action: { type: 'task', id: 'yours', text: 'Para ti', assignee: YOU, place: null },
        },
      ],
    });
    run.start();
    own.push(userTask(1, { assignee: null, place: null, text: 'Para cualquiera' }));
    await wait(20);
    expect(sent.flatMap((event) => (event.type === 'task' ? [event.status] : []))).toEqual([
      'open',
    ]);
    run.stop();
  });

  it('answers a teammate’s SOS by itself, and ends it once the user has seen it', async () => {
    const { run, sent, own, state, nodeOf, wait, lastPosition, said } = practice({
      steps: [
        {
          at: 2,
          by: 'Jordi',
          action: { type: 'sos', id: 'sos', kind: 'medical', text: 'Tobillo' },
        },
      ],
    });
    run.start();
    await wait(3);
    const [sos] = state().sos.values();
    if (sos === undefined) throw new Error('no SOS');
    // Carmen answers within 35 s, walks 100 m at 2 m/s and stays half a minute.
    await wait(40);
    expect(sent.find((event) => event.type === 'ack')).toMatchObject({ origin: nodeOf('Carmen') });
    expect(said().at(-1)).toMatch(/^Carmen: .*Jordi/);
    await wait(60);
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, HERE)).toBeLessThan(1);
    // Answering it is the user's to practise: it stays open until they have, and someone asks.
    await wait(60);
    expect(state().sosCancels.size).toBe(0);
    expect(said().some((line) => line.includes('¿has visto el SOS de Jordi?'))).toBe(true);
    own.push({ ...userEvent(1), type: 'ack', target: { origin: sos.origin, seq: sos.seq } });
    await wait(2);
    expect(state().sosCancels.size).toBe(1);
    expect(said().at(-1)).toMatch(/^Carmen: .*con Jordi/);
    run.stop();
  });

  it('keeps to the streets on the way', async () => {
    // One street east from Jordi, then north to where he is sent: never across the block.
    const streets = [
      [HERE, at(0, 100), at(100, 100)],
      [at(100, 0), at(100, 100)],
    ];
    const { run, own, nodeOf, wait, lastPosition } = practice({ streets });
    run.start();
    await wait(1);
    own.push(
      userTask(1, {
        assignee: nodeOf('Jordi'),
        place: point(at(100, 100)),
        text: 'Ir a la esquina',
      }),
    );
    for (let second = 0; second < 110; second += 10) {
      await wait(10);
      const where = eastNorthMeters(HERE, lastPosition('Jordi') ?? HERE);
      // On the street east, or on the one north: never inside the block.
      expect(Math.min(Math.abs(where.north), Math.abs(where.east - 100))).toBeLessThan(1);
    }
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(100, 100))).toBeLessThan(1);
    run.stop();
  });

  it('says there is no way to a task beyond what cannot be crossed, and leaves it', async () => {
    // The only street east is under water half-way along.
    const flooded: World = {
      passable: () => (where) => distanceMeters(where, at(0, 50)) > 20,
      tick: () => undefined,
    };
    const { run, own, nodeOf, wait, statuses, said } = practice({
      streets: [[HERE, at(0, 100)]],
      world: flooded,
    });
    run.start();
    await wait(1);
    own.push(
      userTask(1, { assignee: nodeOf('Jordi'), place: point(at(0, 100)), text: 'Al fondo' }),
    );
    await wait(30);
    expect(statuses()).toEqual([]);
    expect(said().at(-1)).toMatch(/^Jordi: .*Al fondo/);
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
    // Taken at 7 s, reached at 57 s, done 75 s later, where it is.
    await wait(125);
    expect(statuses()).toEqual(['Jordi Lejos: in-progress', 'Jordi Lejos: done']);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(0, 100))).toBeLessThan(1);
    // Then the other: 6 s to take it, 60 s to walk there, 75 s there.
    await wait(145);
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
    // Taken at 7 s, reached at 27 s, done 75 s later; Carmen, in no team, stays where she is.
    await wait(105);
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
    // Carmen takes it 6 s later, walks some 117 m in 58 s, and works there 75 s.
    await wait(145);
    expect(statuses()).toEqual(['Jordi Ir: in-progress', 'Carmen Ir: done']);
    expect([...state().tasks.values()][0]?.status).toBe('done');
    expect(distanceMeters(lastPosition('Carmen') ?? HERE, at(0, 60))).toBeLessThan(1);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, stopped)).toBeLessThan(15);
    run.stop();
  });

  it('goes back to a task left to help, and is done only once through it', async () => {
    const { run, own, state, nodeOf, wait, lastPosition, statuses } = practice({
      steps: [
        { at: 30, by: 'Carmen', action: { type: 'sos', id: 'sos', kind: 'medical', text: '' } },
      ],
    });
    run.start();
    await wait(1);
    own.push(userTask(1, { assignee: nodeOf('Jordi'), place: point(at(0, 200)), text: 'Este' }));
    await wait(40);
    const [sos] = state().sos.values();
    if (sos === undefined) throw new Error('no SOS');
    own.push({ ...userEvent(2), type: 'ack', target: { origin: sos.origin, seq: sos.seq } });
    // Jordi answers within 35 s, walks to Carmen, stays half a minute, and goes back to his task.
    await wait(180);
    expect(state().sosCancels.size).toBe(1);
    expect(statuses()).toEqual(['Jordi Este: in-progress']);
    await wait(270);
    expect(statuses()).toEqual(['Jordi Este: in-progress', 'Jordi Este: done']);
    expect(distanceMeters(lastPosition('Jordi') ?? HERE, at(0, 200))).toBeLessThan(1);
    run.stop();
  });

  it('sweeps a strip lane by lane across the blocks, and marks the area cleared', async () => {
    // One street, along the south edge of the area: the lanes run north across the block.
    const { run, sent, own, state, nodeOf, wait, lastPosition, statuses } = practice({
      streets: [[at(0, -50), at(0, 150)]],
    });
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

  it('answers what the user says, by name when named, and not every time otherwise', async () => {
    const { run, own, wait, said } = practice();
    run.start();
    own.push({ ...userEvent(1), type: 'chat', text: 'Hola' });
    own.push({ ...userEvent(2), type: 'chat', text: '¿Me oís?' });
    await wait(10);
    expect(said()).toHaveLength(1);
    expect(said()[0]).toMatch(/^Carmen: (Recibido|Entendido|De acuerdo)\.$/);
    own.push({ ...userEvent(3), type: 'chat', text: 'Jordi, ¿dónde estás?' });
    await wait(10);
    expect(said()).toHaveLength(2);
    expect(said()[1]).toMatch(/^Jordi: .*«Punto de encuentro»|^Jordi: /);
    run.stop();
  });

  it('has teammates with nothing to do ask a coordinating user for work', async () => {
    const { run, wait, said } = practice({ user: 'coordinator' });
    run.start();
    await wait(80);
    expect(said()).toEqual([]);
    await wait(20);
    expect(said()).toHaveLength(1);
    expect(said()[0]).toMatch(/Jordi y Carmen|Carmen y Jordi/);
    await wait(120);
    expect(said()).toHaveLength(1);
    run.stop();
  });

  it('runs a phone down, says so, and goes quiet when it is flat', async () => {
    const jordi: Persona = { profile: 'volunteer', equipment: ['light'], battery: 22, drain: 1 };
    const { run, sent, nodeOf, wait, said } = practice({ personas: { Jordi: jordi } });
    run.start();
    await wait(3 * 60);
    // One word to the team as its battery drops below 20 %.
    const states = sent.filter(
      (event) => event.type === 'member-state' && event.origin === nodeOf('Jordi'),
    );
    expect(states).toHaveLength(1);
    await wait(8 * 60);
    expect(said().some((line) => line.startsWith('Jordi: Me queda un 15 %'))).toBe(true);
    const before = sent.filter(
      (event) => event.type === 'position' && event.origin === nodeOf('Jordi'),
    ).length;
    await wait(10 * 60);
    expect(said().some((line) => line.startsWith('Jordi: Me quedo sin batería'))).toBe(true);
    const after = sent.filter(
      (event) => event.type === 'position' && event.origin === nodeOf('Jordi'),
    ).length;
    // Once a minute while saving its battery, for some eight minutes, then nothing.
    expect(after - before).toBeLessThan(10);
    run.stop();
  });

  it('plays its injects, lets its world act, and ends', async () => {
    const injects: Inject[] = [
      {
        at: 5,
        run: (stage) => {
          stage.say('Carmen', 'Llamada del 112');
        },
      },
      {
        at: 10,
        run: (stage) => {
          stage.finish('Fin');
        },
      },
    ];
    const ticks: number[] = [];
    const world: World = { passable: () => () => true, tick: (stage) => ticks.push(stage.elapsed) };
    const { run, wait, said, finished } = practice({ injects, world });
    run.start();
    await wait(12);
    expect(said()).toEqual(['Carmen: Llamada del 112', 'Carmen: Fin']);
    expect(finished()).toBe(true);
    expect(ticks.length).toBeGreaterThan(9);
    const after = ticks.length;
    await wait(10);
    expect(ticks.length).toBe(after);
    run.stop();
  });

  it('ends once its time is up', async () => {
    const { run, wait, said, finished } = practice({ seconds: 30 });
    run.start();
    await wait(31);
    expect(finished()).toBe(true);
    expect(said().at(-1)).toBe(`Carmen: ${t('practiceTimeUp')}`);
    run.stop();
  });

  it('plays on past an action that cannot be done', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { run, sent, wait } = practice({
      steps: [
        { at: 2, by: 'Jordi', action: { type: 'ack', of: 'nothing' } },
        { at: 3, by: 'Carmen', action: { type: 'chat', text: 'Sigo aquí' } },
      ],
    });
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
    own.push({ ...userEvent(1), type: 'chat', text: '¿Me oís?' });
    run.react(state());
    expect(vi.getTimerCount()).toBe(0);
  });
});
