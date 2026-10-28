// A wildfire: the fire front is north of the houses and the wind blows towards them. The front, the
// area at risk, a road closure and the evacuation route along the streets are marked. With the user
// as a member, Carmen sends one team to clear the houses at risk, the other to the road closure,
// and the user to take water to the meeting point; with the user as coordinator, that is the
// user's to decide.

import { ShapeStyleCode, SymbolCode, type LatLon, type Role } from '@tesel/protocol';
import { YOU, type Scenario } from '@tesel/scenario';

import type { Translate } from '../../i18n/index.ts';
import {
  CARMEN,
  introductions,
  JORDI,
  LUIS,
  MARTA,
  martasSos,
  MEETING_POINT,
  meetingPoint,
  NORTH,
  placeAround,
  PRACTICE_SECONDS,
  SOUTH,
  step,
  teammates,
  teams,
  warningAndRollCall,
} from './stage.ts';

const AT_RISK = 'area-at-risk';
const CLOSURE = 'road-closure';

export function wildfire(t: Translate, centre: LatLon, user: Role): Scenario {
  const at = placeAround(centre);
  const organiser = user === 'member' ? CARMEN : LUIS;
  return {
    name: 'wildfire',
    description: t('practiceWildfire'),
    center: centre,
    duration: PRACTICE_SECONDS,
    members: teammates(at, user),
    steps: [
      ...introductions({
        [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'vehicle'], battery: 77 },
        [JORDI]: { profile: 'firefighters', equipment: ['extinguisher', 'radio'], battery: 69 },
        [LUIS]: { profile: 'volunteer', equipment: ['water', 'light'], battery: 88 },
        [MARTA]: { profile: 'medical', equipment: ['first-aid', 'defibrillator'], battery: 61 },
      }),
      step(3, CARMEN, { type: 'chat', text: t('practiceWildfireArrived') }),
      meetingPoint(t, at, 'practiceWildfireMeetingPoint'),
      step(12, LUIS, {
        type: 'marker',
        id: 'front',
        symbol: SymbolCode.FIRE,
        label: t('practiceWildfireFront'),
        where: at(330, 80),
      }),
      step(18, organiser, {
        type: 'shape',
        id: AT_RISK,
        style: ShapeStyleCode.DANGER,
        label: t('practiceWildfireArea'),
        geometry: {
          kind: 'polygon',
          points: [at(150, -40), at(150, 200), at(280, 200), at(280, -40)],
        },
      }),
      step(22, LUIS, {
        type: 'shape',
        id: 'evacuation',
        style: ShapeStyleCode.ROUTE,
        label: t('practiceEvacuation'),
        geometry: { kind: 'polyline', points: [at(210, 80), at(40, -40), at(-60, -80)] },
      }),
      step(26, JORDI, {
        type: 'marker',
        id: CLOSURE,
        symbol: SymbolCode.BLOCKED_ROAD,
        label: t('practiceWildfireClosure'),
        where: at(200, 300),
      }),
      ...(user === 'member'
        ? [
            ...teams(t),
            step(34, CARMEN, {
              type: 'task',
              id: 'clear-houses',
              text: t('practiceWildfireClearHouses'),
              assignee: NORTH,
              place: { kind: 'object', id: AT_RISK },
            }),
            step(36, CARMEN, {
              type: 'task',
              id: 'hold-closure',
              text: t('practiceWildfireHoldClosure'),
              assignee: SOUTH,
              place: { kind: 'object', id: CLOSURE },
            }),
            step(40, CARMEN, {
              type: 'task',
              id: 'water',
              text: t('practiceWildfireWater'),
              assignee: YOU,
              place: { kind: 'object', id: MEETING_POINT },
            }),
            step(45, CARMEN, { type: 'chat', text: t('practiceOrders') }),
          ]
        : [
            step(30, LUIS, { type: 'chat', text: t('practiceWildfireAreaReady') }),
            step(45, JORDI, { type: 'chat', text: t('practiceAwaitingOrders') }),
          ]),
      ...martasSos(t, { kind: 'medical', text: 'practiceWildfireSos' }, LUIS),
      ...(user === 'member'
        ? warningAndRollCall(t, { level: 'critical', text: 'practiceWildfireWarning' })
        : []),
      step(360, JORDI, {
        type: 'report',
        incident: 'fire',
        hazards: ['fire', 'smoke'],
        access: 'blocked',
        casualties: { red: null, yellow: 1, green: null, black: null },
        resources: ['firefighters', 'helicopter'],
        note: t('practiceWildfireReport'),
      }),
    ],
  };
}
