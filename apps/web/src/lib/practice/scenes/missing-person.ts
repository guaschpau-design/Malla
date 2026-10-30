// A missing person: Rosa, 78, went for a walk this morning and has not come back. Where she was
// last seen is marked; her daughter guesses which way she went, and the first search sector is
// drawn that way. It is the wrong way. Seven minutes in, a witness (or a neighbour the user asks,
// when the user is a member) tells the right one; whoever coordinates must move the search. Rosa is
// found only by someone who passes near her (missing-person-world.ts). With the user as a member,
// Carmen coordinates: she splits each sector into two strips, one per team, gives the user the
// neighbours to ask, and moves the search when the witness calls; with the user as coordinator,
// all that is theirs to do.

import { offsetMeters } from '@tesel/core';
import { ShapeStyleCode, SymbolCode, type LatLon } from '@tesel/protocol';
import { YOU, type ScenarioStep } from '@tesel/scenario';

import type { Exercise, Inject, Setting, Stage } from '../exercise.ts';
import { heading } from '../ground.ts';
import { landmarkOf } from '../landmark.ts';
import {
  CARMEN,
  cast,
  dispatch,
  EXERCISE_SECONDS,
  introductions,
  JORDI,
  leader,
  LUIS,
  MARTA,
  meetingPoint,
  NORTH,
  NURIA,
  PABLO,
  personas,
  placeAround,
  SARA,
  SOUTH,
  sosToPractise,
  step,
  teams,
} from './cast.ts';
import { MissingPersonWorld } from './missing-person-world.ts';
import { missingPersonFindings } from './missing-person-findings.ts';

/** The ids of what the exercise creates, for later actions to refer to. */
const LAST_SEEN = 'last-seen';
const SECTOR_1 = 'sector-1';
const SECTOR_2 = 'sector-2';
const ASK_AROUND = 'ask-around';

/** When the witness calls, unless the user has learnt which way she went before. */
const WITNESS_S = 360;
/** When Carmen sends Sara to the neighbour who fell, once they have. */
const FALL_ORDER_S = 800;
/** Lanes of the sweeps, in metres apart: a street search, where houses line both sides. */
const SPACING_M = 60;

export function missingPerson(setting: Setting): Exercise {
  const { t, centre, user } = setting;
  const at = placeAround(centre);
  const world = new MissingPersonWorld(setting, at);
  const people = personas({
    [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'light', 'lora'] },
    [JORDI]: { profile: 'volunteer', equipment: ['light', 'water'] },
    [LUIS]: { profile: 'rescue', equipment: ['rope', 'radio', 'light', 'lora'] },
    [MARTA]: { profile: 'medical', equipment: ['first-aid', 'blankets'] },
    [NURIA]: { profile: 'firefighters', equipment: ['light', 'radio', 'lora'] },
    [PABLO]: { profile: 'volunteer', equipment: ['vehicle', 'water', 'food'] },
    [SARA]: { profile: 'medical', equipment: ['first-aid', 'defibrillator', 'drone'] },
  });
  const briefer = user === 'member' ? CARMEN : dispatch(t);
  const briefing: ScenarioStep[] = [
    step(3, briefer, {
      type: 'chat',
      text: t(user === 'member' ? 'practiceMissingArrived' : 'practiceMissingCall'),
    }),
    step(4, briefer, { type: 'chat', text: t('practiceMissingDescribed') }),
  ];
  return {
    scenario: {
      name: 'missing-person',
      description: t('practiceMissingPerson'),
      center: centre,
      duration: EXERCISE_SECONDS,
      members: cast(t, at, user),
      steps: [
        ...introductions(people),
        ...briefing,
        meetingPoint(t, at, 'practiceMeetingPoint'),
        ...(user === 'member' ? teams(t) : []),
      ],
    },
    personas: people,
    world,
    injects: [
      ...opening(world),
      ...(user === 'member' ? carmensOrders(world) : []),
      sosToPractise(t, 360, { kind: 'medical', text: 'practiceMissingSos' }),
      {
        at: 900,
        run: (stage) => {
          stage.say(leader(stage.t, stage.user.role), stage.t('practiceMissingDusk'));
        },
      },
    ],
    findings: missingPersonFindings(world),
    seconds: EXERCISE_SECONDS,
  };
}

/** Where she was last seen, which way her daughter guesses, the first sector, and the witness. */
function opening(world: MissingPersonWorld): Inject[] {
  return [
    {
      at: 12,
      run: (stage) => {
        stage.act(dispatch(stage.t), {
          type: 'marker',
          id: LAST_SEEN,
          symbol: SymbolCode.MISSING,
          label: stage.t('practiceMissingLastSeen'),
          where: world.lastSeen,
        });
      },
    },
    {
      at: 18,
      run: (stage) => {
        const direction = heading(stage.t, world.guessed);
        stage.say(dispatch(stage.t), stage.t('practiceMissingDaughter', { direction }));
      },
    },
    {
      at: 30,
      run: (stage) => {
        const drawer = stage.user.role === 'member' ? CARMEN : LUIS;
        stage.act(drawer, {
          type: 'shape',
          id: SECTOR_1,
          style: ShapeStyleCode.SEARCH_ASSIGNED,
          label: stage.t('practiceMissingSector', { sector: 1 }),
          geometry: {
            kind: 'polygon',
            points: sector(world.lastSeen, world.guessed, 260, 20, 260),
          },
        });
        if (stage.user.role === 'coordinator') {
          stage.say(LUIS, stage.t('practiceMissingSectorReady'));
        }
      },
    },
    {
      at: 60,
      when: (stage) => stage.elapsed >= WITNESS_S || askedAround(stage),
      run: (stage) => {
        const direction = heading(stage.t, world.went);
        if (askedAround(stage)) {
          stage.say(
            CARMEN,
            stage.t('practiceMissingNeighbour', { name: stage.user.name, direction }),
          );
          return;
        }
        const where = stage.ground.address(stage.t, world.lastSeen, landmarkOf(stage));
        stage.say(dispatch(stage.t), stage.t('practiceMissingWitness', { where, direction }));
      },
    },
  ];
}

/**
 * When the user is a member, Carmen splits the first sector between the two teams and sends the
 * user to ask the neighbours; once she knows which way Rosa went, she moves the search there.
 */
function carmensOrders(world: MissingPersonWorld): Inject[] {
  const sweep = (area: string, strip: number, lanes: number) => ({
    type: 'sweep' as const,
    id: `${area}-strip-${String(strip)}`,
    area,
    spacing: SPACING_M,
    heading: lanes,
    strip,
    strips: 2,
  });
  return [
    {
      at: 40,
      run: (stage) => {
        const lanes = laneHeading(world.guessed);
        stage.act(CARMEN, sweep(SECTOR_1, 0, lanes));
        stage.act(CARMEN, sweep(SECTOR_1, 1, lanes));
        for (const [strip, team] of [NORTH, SOUTH].entries()) {
          stage.act(CARMEN, {
            type: 'task',
            id: `${SECTOR_1}-${team}`,
            text: stage.t('practiceMissingStrip', { strip: strip + 1, sector: 1 }),
            assignee: team,
            place: { kind: 'object', id: `${SECTOR_1}-strip-${String(strip)}` },
          });
        }
        stage.act(CARMEN, {
          type: 'task',
          id: ASK_AROUND,
          text: stage.t('practiceMissingAskAround'),
          assignee: YOU,
          place: { kind: 'point', at: world.lastSeen },
        });
        stage.say(CARMEN, stage.t('practiceOrders'));
      },
    },
    {
      at: 80,
      when: (stage) => stage.elapsed >= WITNESS_S + 20 || askedAround(stage),
      run: (stage) => {
        stage.say(
          CARMEN,
          stage.t('practiceMissingReplan', { direction: heading(stage.t, world.went) }),
        );
        stage.act(CARMEN, {
          type: 'shape',
          id: SECTOR_2,
          style: ShapeStyleCode.SEARCH_ASSIGNED,
          label: stage.t('practiceMissingSector', { sector: 2 }),
          geometry: { kind: 'polygon', points: sector(world.lastSeen, world.went, 400, 200, 520) },
        });
        const lanes = laneHeading(world.went);
        stage.act(CARMEN, sweep(SECTOR_2, 0, lanes));
        stage.act(CARMEN, sweep(SECTOR_2, 1, lanes));
        for (const [strip, team] of [NORTH, SOUTH].entries()) {
          stage.act(CARMEN, {
            type: 'task-status',
            of: `${SECTOR_1}-${team}`,
            status: 'cancelled',
          });
          stage.act(CARMEN, {
            type: 'task',
            id: `${SECTOR_2}-${team}`,
            text: stage.t('practiceMissingStrip', { strip: strip + 1, sector: 2 }),
            assignee: team,
            place: { kind: 'object', id: `${SECTOR_2}-strip-${String(strip)}` },
          });
        }
      },
    },
    {
      at: FALL_ORDER_S,
      when: () => world.fall !== null,
      run: (stage) => {
        stage.act(CARMEN, {
          type: 'task',
          id: 'see-to-fall',
          text: stage.t('practiceMissingSeeToFall'),
          assignee: SARA,
          place: { kind: 'object', id: 'fall' },
        });
        stage.say(CARMEN, stage.t('practiceMissingSendSara'));
      },
    },
  ];
}

/** Lanes that run along a sector drawn on a bearing: a sweep's heading, from 0 to 179 degrees. */
function laneHeading(bearing: number): number {
  return Math.round(bearing) % 180;
}

/** Whether the user has asked the neighbours, the task Carmen gave them. */
function askedAround(stage: Stage): boolean {
  return [...stage.state.tasks.values()].some(
    (task) =>
      task.status === 'done' &&
      task.origin === stage.user.node &&
      task.text === stage.t('practiceMissingAskAround'),
  );
}

/**
 * A search sector as a coordinator draws it: a box `width` metres wide reaching from `near` to
 * `far` metres from a point, along a bearing.
 */
function sector(from: LatLon, bearing: number, width: number, near: number, far: number): LatLon[] {
  const rad = (bearing * Math.PI) / 180;
  const [along, across] = [
    { north: Math.cos(rad), east: Math.sin(rad) },
    { north: -Math.sin(rad), east: Math.cos(rad) },
  ];
  const corner = (forward: number, side: number) =>
    offsetMeters(
      from,
      along.north * forward + across.north * side,
      along.east * forward + across.east * side,
    );
  return [
    corner(near, -width / 2),
    corner(near, width / 2),
    corner(far, width / 2),
    corner(far, -width / 2),
  ];
}
