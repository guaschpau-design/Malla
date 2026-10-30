// A wildfire: it started in the scrub north of the place and the wind drives it towards the houses
// (wildfire-world.ts). The control room has the road closed and the aircraft on their way; twelve
// minutes in, the wind turns as forecast, and the fire heads for other houses; at sixteen, the
// medical helicopter needs somewhere to land, which someone must mark on the map. With the user as
// a member, Carmen sends the north team to empty the houses at risk, the south team to hold the
// road closed and the user to take water to the meeting point, and moves the south team to the new
// front when the wind turns; with the user as coordinator, all that is theirs to decide.

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
  MEETING_POINT,
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
import { AIRCRAFT_S, AT_RISK, WildfireWorld, WIND_TURNS_S } from './wildfire-world.ts';

const CLOSURE = 'road-closure';
/** When the helicopter asks for somewhere to land, and how long it can wait. */
const HELIPAD_S = 960;
const HELIPAD_WAITS_S = 240;

export function wildfire(setting: Setting): Exercise {
  const { t, centre, user } = setting;
  const at = placeAround(centre);
  const world = new WildfireWorld(setting, at);
  const people = personas({
    [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'vehicle', 'lora'] },
    [JORDI]: { profile: 'volunteer', equipment: ['water', 'light'] },
    [LUIS]: { profile: 'rescue', equipment: ['radio', 'rope', 'lora'] },
    [MARTA]: { profile: 'medical', equipment: ['first-aid', 'defibrillator'] },
    [NURIA]: { profile: 'firefighters', equipment: ['extinguisher', 'radio', 'lora'] },
    [PABLO]: { profile: 'volunteer', equipment: ['vehicle', 'water'] },
    [SARA]: { profile: 'medical', equipment: ['first-aid', 'blankets'] },
  });
  const briefing: ScenarioStep =
    user === 'member'
      ? step(3, CARMEN, { type: 'chat', text: t('practiceWildfireArrived') })
      : step(3, dispatch(t), { type: 'chat', text: t('practiceWildfireCall') });
  return {
    scenario: {
      name: 'wildfire',
      description: t('practiceWildfire'),
      center: centre,
      duration: EXERCISE_SECONDS,
      members: cast(t, at, user),
      steps: [
        ...introductions(people),
        briefing,
        meetingPoint(t, at, 'practiceWildfireMeetingPoint'),
        ...(user === 'member' ? teams(t) : []),
      ],
    },
    personas: people,
    world,
    injects: [
      ...story(world, at(220, 240)),
      ...(user === 'member' ? carmensOrders() : []),
      sosToPractise(t, 360, { kind: 'medical', text: 'practiceWildfireSos' }),
    ],
    seconds: EXERCISE_SECONDS,
  };
}

/** What the control room tells of on its own. */
type RoomCall =
  | 'practiceFireRoadClosed'
  | 'practiceFireAircraft'
  | 'practiceFireWindForecast'
  | 'practiceFireHelipad'
  | 'practiceFireHelipadOk'
  | 'practiceFireHelipadLate'
  | 'practiceFireAircraftWorking';

/** The area at risk, the road closed, the aircraft, the wind, and the helicopter. */
function story(world: WildfireWorld, closure: { lat: number; lon: number }): Inject[] {
  const room = (stage: Stage, text: RoomCall) => {
    stage.say(dispatch(stage.t), stage.t(text));
  };
  const drawRisk = (stage: Stage) => {
    stage.act(leader(stage.t, stage.user.role), {
      type: 'shape',
      id: AT_RISK,
      style: ShapeStyleCode.DANGER,
      label: stage.t('practiceWildfireArea'),
      geometry: { kind: 'polygon', points: world.atRisk(stage) },
    });
  };
  return [
    { at: 30, run: drawRisk },
    {
      at: 34,
      run: (stage) => {
        stage.say(NURIA, stage.t('practiceFireHeading', { direction: world.heading(stage) }));
      },
    },
    {
      at: 40,
      run: (stage) => {
        stage.act(dispatch(stage.t), {
          type: 'marker',
          id: CLOSURE,
          symbol: SymbolCode.BLOCKED_ROAD,
          label: stage.t('practiceWildfireClosure'),
          where: stage.ground.snap(closure),
        });
        room(stage, 'practiceFireRoadClosed');
      },
    },
    {
      at: 240,
      run: (stage) => {
        room(stage, 'practiceFireAircraft');
      },
    },
    {
      at: WIND_TURNS_S - 60,
      run: (stage) => {
        room(stage, 'practiceFireWindForecast');
      },
    },
    {
      at: WIND_TURNS_S,
      run: (stage) => {
        stage.say(NURIA, stage.t('practiceFireWindTurned', { direction: world.heading(stage) }));
      },
    },
    { at: WIND_TURNS_S + 20, run: drawRisk },
    {
      at: HELIPAD_S,
      run: (stage) => {
        room(stage, 'practiceFireHelipad');
      },
    },
    {
      at: HELIPAD_S + 5,
      when: (stage) => helipadMarked(stage) || stage.elapsed >= HELIPAD_S + HELIPAD_WAITS_S,
      run: (stage) => {
        room(stage, helipadMarked(stage) ? 'practiceFireHelipadOk' : 'practiceFireHelipadLate');
      },
    },
    {
      at: AIRCRAFT_S,
      run: (stage) => {
        room(stage, 'practiceFireAircraftWorking');
      },
    },
  ];
}

/**
 * When the user is a member: Carmen sends the north team to empty the houses at risk, the south
 * team to the road closure, and the user with water; when the wind turns, the south team to the new
 * front; when the helicopter asks, the user to mark where it can land.
 */
function carmensOrders(): Inject[] {
  return [
    {
      at: 45,
      run: (stage) => {
        stage.act(CARMEN, {
          type: 'task',
          id: 'empty-houses',
          text: stage.t('practiceWildfireClearHouses'),
          assignee: NORTH,
          place: { kind: 'object', id: AT_RISK },
        });
        stage.act(CARMEN, {
          type: 'task',
          id: 'hold-closure',
          text: stage.t('practiceWildfireHoldClosure'),
          assignee: SOUTH,
          place: { kind: 'object', id: CLOSURE },
        });
        stage.act(CARMEN, {
          type: 'task',
          id: 'water',
          text: stage.t('practiceWildfireWater'),
          assignee: YOU,
          place: { kind: 'object', id: MEETING_POINT },
        });
        stage.say(CARMEN, stage.t('practiceOrders'));
      },
    },
    {
      at: WIND_TURNS_S + 40,
      run: (stage) => {
        stage.act(CARMEN, { type: 'task-status', of: 'hold-closure', status: 'cancelled' });
        stage.act(CARMEN, {
          type: 'task',
          id: 'new-front',
          text: stage.t('practiceFireNewFront'),
          assignee: SOUTH,
          place: { kind: 'object', id: AT_RISK },
        });
        stage.say(CARMEN, stage.t('practiceFireNewFrontChat'));
      },
    },
    {
      at: HELIPAD_S + 10,
      run: (stage) => {
        stage.act(CARMEN, {
          type: 'task',
          id: 'helipad',
          text: stage.t('practiceFireMarkHelipad'),
          assignee: YOU,
          place: null,
        });
        stage.say(CARMEN, stage.t('practiceFireMarkHelipadChat', { name: stage.user.name }));
      },
    },
  ];
}

/** Whether someone has marked where the helicopter can land. */
function helipadMarked(stage: Stage): boolean {
  return [...stage.state.objects.values()].some(
    (record) => record.type === 'marker' && record.symbol === SymbolCode.HELICOPTER,
  );
}
