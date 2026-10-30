// A flood: the stream of the map nearest to the place (a ravine where there is none) has burst its
// banks after a night of storms upstream, and the water rises for a quarter of an hour
// (flood-world.ts). The control room tells of the homes it knows to be at risk and of the area the
// technicians expect to flood; the lowest underpass and the evacuation route are marked. With the
// user as a member, Carmen sends the north team to warn the neighbours in that area, the south team
// along the evacuation route and the user to close the underpass, and sends a team with a rope
// wherever the water traps someone; with the user as coordinator, all that is theirs to decide.

import { ShapeStyleCode, SymbolCode } from '@tesel/protocol';
import { YOU, type ScenarioStep } from '@tesel/scenario';

import type { Exercise, Inject, Setting, Stage } from '../exercise.ts';
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
import { EVACUATION, FLOODABLE, FloodWorld, UNDERPASS } from './flood-world.ts';
import { floodFindings } from './flood-findings.ts';

export function flood(setting: Setting): Exercise {
  const { t, centre, user } = setting;
  const at = placeAround(centre);
  const world = new FloodWorld(setting, at);
  const river = world.river === null ? t('practiceFloodRavine') : setting.ground.said(world.river);
  const people = personas({
    [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'vehicle', 'lora'] },
    [JORDI]: { profile: 'volunteer', equipment: ['light', 'water'] },
    [LUIS]: { profile: 'rescue', equipment: ['rope', 'radio', 'lora'] },
    [MARTA]: { profile: 'medical', equipment: ['first-aid', 'stretcher'] },
    [NURIA]: { profile: 'firefighters', equipment: ['rope', 'light', 'lora'] },
    [PABLO]: { profile: 'volunteer', equipment: ['vehicle', 'blankets'] },
    [SARA]: { profile: 'medical', equipment: ['first-aid', 'defibrillator'] },
  });
  const briefing: ScenarioStep =
    user === 'member'
      ? step(3, CARMEN, { type: 'chat', text: t('practiceFloodArrived', { river }) })
      : step(3, dispatch(t), { type: 'chat', text: t('practiceFloodCall', { river }) });
  return {
    scenario: {
      name: 'flood',
      description: t('practiceFlood'),
      center: centre,
      duration: EXERCISE_SECONDS,
      members: cast(t, at, user),
      steps: [
        ...introductions(people),
        briefing,
        meetingPoint(t, at, 'practiceMeetingPoint'),
        step(22, LUIS, {
          type: 'shape',
          id: EVACUATION,
          style: ShapeStyleCode.ROUTE,
          label: t('practiceEvacuation'),
          geometry: { kind: 'polyline', points: world.route },
        }),
        step(26, JORDI, {
          type: 'marker',
          id: UNDERPASS,
          symbol: SymbolCode.HAZARD,
          label: t('practiceFloodUnderpassLabel'),
          where: world.underpass,
        }),
        ...(user === 'member' ? teams(t) : []),
      ],
    },
    personas: people,
    world,
    injects: [
      ...story(world),
      ...(user === 'member' ? carmensOrders(world) : []),
      sosToPractise(t, 360, { kind: 'trapped', text: 'practiceFloodSos' }),
    ],
    findings: floodFindings(world),
    seconds: EXERCISE_SECONDS,
  };
}

/** What the control room tells of on its own. */
type RoomCall =
  | 'practiceFloodRedAlert'
  | 'practiceFloodRising'
  | 'practiceFloodPowerCut'
  | 'practiceFloodSteady'
  | 'practiceFloodFalling';

/** What the control room tells as the water comes and goes. */
function story(world: FloodWorld): Inject[] {
  const call = (at: number, text: RoomCall): Inject => ({
    at,
    run: (stage) => {
      stage.say(dispatch(stage.t), stage.t(text));
    },
  });
  return [
    call(60, 'practiceFloodRedAlert'),
    {
      at: 90,
      run: (stage) => {
        world.homes.tellOf(stage);
      },
    },
    {
      at: 110,
      run: (stage) => {
        const drawer = leader(stage.t, stage.user.role);
        stage.act(drawer, {
          type: 'shape',
          id: FLOODABLE,
          style: ShapeStyleCode.NEUTRAL,
          label: stage.t('practiceFloodFloodable'),
          geometry: { kind: 'polygon', points: world.floodable },
        });
        stage.say(drawer, stage.t('practiceFloodFloodableChat'));
      },
    },
    call(300, 'practiceFloodRising'),
    call(600, 'practiceFloodPowerCut'),
    call(900, 'practiceFloodSteady'),
    call(1200, 'practiceFloodFalling'),
  ];
}

/** When the user is a member: Carmen sends each team, and the user, to their work. */
function carmensOrders(world: FloodWorld): Inject[] {
  return [
    {
      at: 125,
      run: (stage) => {
        world.homes.warnKnown(stage);
        stage.act(CARMEN, {
          type: 'task',
          id: 'check-route',
          text: stage.t('practiceFloodCheckRoute'),
          assignee: SOUTH,
          place: { kind: 'object', id: EVACUATION },
        });
        stage.act(CARMEN, {
          type: 'task',
          id: 'underpass',
          text: stage.t('practiceFloodUnderpass'),
          assignee: YOU,
          place: { kind: 'object', id: UNDERPASS },
        });
        stage.say(CARMEN, stage.t('practiceOrders'));
      },
    },
    {
      at: 130,
      when: (stage) => done(stage, 'practiceFloodCheckRoute'),
      run: (stage) => {
        stage.act(CARMEN, {
          type: 'task',
          id: 'door-to-door',
          text: stage.t('practiceFloodDoorToDoor'),
          assignee: PABLO,
          place: { kind: 'object', id: FLOODABLE },
        });
        stage.say(CARMEN, stage.t('practiceFloodDoorToDoorChat'));
      },
    },
    {
      at: 600,
      run: (stage) => {
        stage.say(CARMEN, stage.t('practiceFloodDark'));
      },
    },
  ];
}

/** Whether a task Carmen gave, by its text, is done. */
function done(stage: Stage, text: 'practiceFloodCheckRoute'): boolean {
  return [...stage.state.tasks.values()].some(
    (task) => task.status === 'done' && task.text === stage.t(text),
  );
}
