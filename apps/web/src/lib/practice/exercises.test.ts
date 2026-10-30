// Each situation played through to its end, in each part, on a small town of its own: what the
// user sees happen when they let it run, answering the SOS calls but giving no orders.

import { appendFileSync } from 'node:fs';

import { EMPTY_STATE, eastNorthMeters, offsetMeters, reduce, type GroupState } from '@tesel/core';
import {
  decodeEvent,
  generateIdentity,
  ShapeStyleCode,
  SymbolCode,
  type LatLon,
  type Role,
  type TeselEvent,
} from '@tesel/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { translator } from '../i18n/index.ts';
import { Chance } from './chance.ts';
import type { Debrief } from './debrief/debrief.ts';
import { Ground } from './ground.ts';
import { HeightGrid } from './heights.ts';
import { PracticeRun } from './practice-run.ts';
import { SITUATION_INFO, type Situation } from './situations.ts';

const HERE = { lat: 39.4699, lon: -0.3763 };
const at = (north: number, east: number) => offsetMeters(HERE, north, east);
const t = translator('es');

/**
 * A town of streets every 100 m for 700 m round here, drawn through their corners, named "Calle"
 * east–west and "Avenida" north–south; a stream 300 m north; a park south-east. On a slope, it is a
 * mountain, its streets its paths, with one more that leads nowhere.
 */
function town(slope: HeightGrid | null = null): Ground {
  const steps = Array.from({ length: 15 }, (_, index) => -700 + index * 100);
  const ways = steps.flatMap((offset, index) => [
    { points: steps.map((east) => at(offset, east)), name: `Calle ${String(index + 1)}` },
    { points: steps.map((north) => at(north, offset)), name: `Avenida ${String(index + 1)}` },
  ]);
  if (slope !== null) ways.push({ points: [at(400, 0), at(450, -50)], name: 'Senda Perdida' });
  return new Ground(
    {
      ways,
      waterways: [{ points: [at(300, -700), at(300, 700)], name: 'Barranco de Prueba' }],
      greens: [
        {
          ring: [at(-300, 100), at(-300, 300), at(-100, 300), at(-100, 100)],
          name: 'Parque de Prueba',
        },
      ],
    },
    slope,
    'es',
  );
}

/** The land rising northwards round here, half a metre a metre: three hundred up in six hundred. */
function slope(): Promise<HeightGrid | null> {
  return HeightGrid.around(HERE, 700, 20, (points) =>
    Promise.resolve(points.map((point) => 900 + 0.5 * eastNorthMeters(HERE, point).north)),
  );
}

/** Plays a situation to its end, the user acknowledging every teammate's SOS. */
async function play(situation: Situation, part: Role, ground = town(), seed = 7) {
  const user = generateIdentity();
  const sent: TeselEvent[] = [];
  let state: GroupState = EMPTY_STATE;
  const setting = {
    t,
    locale: 'es' as const,
    centre: HERE,
    user: part,
    ground,
    chance: new Chance(seed),
  };
  const outcome: { debrief: Debrief | null } = { debrief: null };
  const run = new PracticeRun(SITUATION_INFO[situation].exercise(setting), {
    sink: (bytes) => {
      const event = decodeEvent(bytes);
      if (event.ok) {
        sent.push(event.value);
        state = reduce(state, event.value);
      }
      return Promise.resolve();
    },
    self: user.nodeId,
    setting,
    onfinish: (debrief) => {
      outcome.debrief = debrief;
    },
  });
  let seq = 0;
  run.start();
  for (let second = 0; second < 26 * 60 && outcome.debrief === null; second += 1) {
    await vi.advanceTimersByTimeAsync(1000);
    for (const [key, sos] of state.sos) {
      if (state.acks.get(key)?.has(user.nodeId) || state.sosCancels.has(key)) continue;
      seq += 1;
      const ack: TeselEvent = {
        origin: user.nodeId,
        seq,
        time: Math.floor(Date.now() / 1000),
        type: 'ack',
        target: { origin: sos.origin, seq: sos.seq },
      };
      state = reduce(state, ack);
    }
    run.react(state);
  }
  // What was said last, the end, goes out before the run stops.
  await vi.advanceTimersByTimeAsync(1000);
  run.stop();
  const said = sent.flatMap((event) => (event.type === 'chat' ? [event.text] : []));
  const show = process.env['SHOW_EXERCISE'];
  if (show) {
    const start = sent[0]?.time ?? 0;
    const lines = sent.flatMap((event) => {
      const who = state.members.get(event.origin)?.alias ?? event.origin;
      const what =
        event.type === 'chat'
          ? event.text
          : event.type === 'task'
            ? `[task ${event.status}] ${event.text}`
            : event.type === 'marker'
              ? `[marker] ${event.label}`
              : event.type === 'sos'
                ? `[SOS] ${event.text}`
                : null;
      return what === null ? [] : [`${String(event.time - start).padStart(5)} ${who}: ${what}`];
    });
    const warned = vi.mocked(console.warn).mock.calls.map((call) => String(call[1]));
    appendFileSync(
      show,
      [
        `== ${situation} as ${part} (over ${String(run.over)}, ${String(run.elapsed)} s)`,
        ...lines,
        ...warned,
        ...(outcome.debrief?.figures.map((figure) => `  ${figure.label}: ${figure.value}`) ?? []),
        ...(outcome.debrief?.good.map((text) => `  + ${text}`) ?? []),
        ...(outcome.debrief?.better.map((text) => `  - ${text}`) ?? []),
        '',
      ].join('\n'),
    );
  }
  const { debrief } = outcome;
  return { sent, state, said, finished: debrief !== null, debrief, user: user.nodeId };
}

/** Markers by their label, as they ended up. */
function markers(state: GroupState, label: string): LatLon[] {
  return [...state.objects.values()].flatMap((record) =>
    record.type === 'marker' && record.label === label
      ? [{ lat: record.lat, lon: record.lon }]
      : [],
  );
}

/** How many versions of a shape, by its label, were sent. */
function versions(sent: readonly TeselEvent[], label: string): number {
  return sent.filter((event) => event.type === 'shape' && event.label === label).length;
}

/** Each one plays twenty-five minutes of an exercise, a second at a time. */
const PLAYING_MS = 30_000;

describe('exercises played through', { timeout: PLAYING_MS }, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    expect(console.warn).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('finds Rosa when Carmen moves the search the way she went', async () => {
    const { state, said, finished, sent, user, debrief } = await play('missing-person', 'member');
    expect(finished).toBe(true);
    expect(debrief?.figures).toContainEqual({
      label: 'Rosa',
      value: expect.stringMatching(/^La encontró el (equipo|la unidad canina)/) as unknown,
    });
    // The user was given the neighbours to ask, and the search moved to a second sector.
    expect(sent.some((event) => event.type === 'task' && event.assignee === user)).toBe(true);
    expect(versions(sent, t('practiceMissingSector', { sector: 2 }))).toBeGreaterThan(0);
    expect(said.some((line) => line.startsWith('Llama un panadero'))).toBe(true);
    // Someone called an SOS to practise answering, and Rosa was found and taken to safety.
    expect(sent.some((event) => event.type === 'sos')).toBe(true);
    expect(markers(state, 'Rosa')).toHaveLength(1);
    expect(said.at(-1)).toMatch(/^Fin del ejercicio: (Rosa ha aparecido|a Rosa la ha encontrado)/);
  });

  it('leaves the search to a coordinator, whose idle team asks what to do', async () => {
    const { said, finished, sent, debrief } = await play('missing-person', 'coordinator');
    expect(finished).toBe(true);
    // The report tells the coordinator they gave no order, and who found Rosa.
    expect(debrief?.better).toContain(t('debriefNoOrders'));
    expect(sent.filter((event) => event.type === 'team' || event.type === 'task')).toEqual([]);
    expect(
      said.some((line) => line.includes('¿Qué hacemos?') || line.includes('¿Nos das algo?')),
    ).toBe(true);
    // Nobody searched the right way: the dog unit found her.
    expect(said.some((line) => line.startsWith('La unidad canina ha encontrado a Rosa'))).toBe(
      true,
    );
  });

  it('floods the low streets from the stream, warns or loses the homes, and says how it went', async () => {
    const { sent, said, finished, state, debrief } = await play('flood', 'member');
    expect(finished).toBe(true);
    expect(debrief?.figures).toContainEqual({
      label: 'Viviendas avisadas a tiempo',
      value: expect.stringMatching(/^\d de 6$/) as unknown,
    });
    expect(said[0]).toContain('el Barranco de Prueba');
    // The water was drawn again and again as it rose.
    expect(versions(sent, t('practiceFloodArea'))).toBeGreaterThan(3);
    const flooded = [...state.objects.values()].find(
      (record) => record.type === 'shape' && record.label === t('practiceFloodArea'),
    );
    expect(flooded).toMatchObject({ style: ShapeStyleCode.DANGER });
    // The north team went door to door: someone was warned, and the end tells how many.
    expect(
      said.some(
        (line) => line.startsWith('Avisados los vecinos') || line.startsWith('En el bajo del n.º'),
      ),
    ).toBe(true);
    expect(said.at(-1)).toMatch(
      /^Fin del ejercicio: el agua baja\. Vecinos avisados a tiempo: \d de \d/,
    );
  });

  it('spreads a fire that turns with the wind, and empties houses before it', async () => {
    const { sent, said, finished, state, debrief } = await play('wildfire', 'member');
    expect(finished).toBe(true);
    expect(debrief?.figures).toContainEqual({ label: 'Zona del helicóptero', value: 'Sin marcar' });
    expect(versions(sent, t('practiceFireFront'))).toBeGreaterThan(15);
    expect(said.some((line) => line.startsWith('¡Ha rolado el viento!'))).toBe(true);
    expect(said.some((line) => line.startsWith('Desalojado el n.º'))).toBe(true);
    // Carmen asked the user to mark where the helicopter can land; nobody did.
    expect(
      said.some((line) => line.startsWith('El helicóptero ha tenido que aterrizar lejos')),
    ).toBe(true);
    expect(
      [...state.objects.values()].some(
        (record) => record.type === 'marker' && record.symbol === SymbolCode.HELICOPTER,
      ),
    ).toBe(false);
    expect(said.at(-1)).toMatch(/^Fin del ejercicio: incendio estabilizado/);
  });

  it('runs a race round the streets, with a runner down and a van on the course', async () => {
    const { sent, said, finished, debrief } = await play('race', 'member');
    expect(finished).toBe(true);
    // Four crossings were marked and given out, the user's among them.
    expect(
      sent.filter((event) => event.type === 'marker' && event.label.startsWith('Corte ')),
    ).toHaveLength(4);
    expect(said.some((line) => line.startsWith('¡Salida!'))).toBe(true);
    expect(said.some((line) => line.startsWith('¡Corredor desplomado'))).toBe(true);
    expect(said.some((line) => line.startsWith('Empiezo la RCP'))).toBe(true);
    expect(debrief?.figures).toContainEqual({
      label: 'Cortes cubiertos al pasar la cabeza',
      value: expect.stringMatching(/^\d de 4$/) as unknown,
    });
    expect(said.at(-1)).toMatch(/^Fin del ejercicio: la carrera sigue/);
  });

  it('climbs a mountain into fog and a storm, with someone lost and someone hurt', async () => {
    const ground = town(await slope());
    const { said, finished, debrief } = await play('mountain', 'member', ground);
    expect(finished).toBe(true);
    expect(said.some((line) => line.startsWith('No veo a nadie'))).toBe(true);
    expect(said.some((line) => line.includes('ha resbalado en la pedrera'))).toBe(true);
    expect(said.some((line) => line.startsWith('Damos la vuelta'))).toBe(true);
    // The user sent no report: Carmen did, late, and the helicopter may or may not make it.
    expect(debrief?.better).toContain(t('debriefMountainCarmenCalled'));
    expect(said.at(-1)).toMatch(/^Fin del ejercicio: el grupo baja/);
  });

  it('leaves the turn back to a coordinator, whom the storm overtakes', async () => {
    const ground = town(await slope());
    const { finished, debrief } = await play('mountain', 'coordinator', ground);
    expect(finished).toBe(true);
    expect(debrief?.better).toContain(t('debriefMountainNeverTurned'));
    expect(debrief?.better).toContain(t('debriefMountainNoCallNote'));
  });

  it('plays the flood, the fire and the race to their end for a coordinator too', async () => {
    for (const situation of ['flood', 'wildfire', 'race'] as const) {
      const { finished, sent } = await play(situation, 'coordinator');
      expect(finished).toBe(true);
      expect(sent.filter((event) => event.type === 'task')).toEqual([]);
    }
  });
});
