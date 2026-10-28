// A flood: a ravine has burst its banks north of the meeting point. A flooded street, the flooded
// area and a blocked crossing are marked, and an evacuation route drawn along the streets. With
// the user as a member, Carmen sends one team to warn the neighbours of the flooded area, the other
// along the evacuation route, and the user to check the underpass; with the user as coordinator,
// that is the user's to decide.

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

const FLOODED = 'flooded-area';
const EVACUATION = 'evacuation-route';

export function flood(t: Translate, centre: LatLon, user: Role): Scenario {
  const at = placeAround(centre);
  const organiser = user === 'member' ? CARMEN : LUIS;
  return {
    name: 'flood',
    description: t('practiceFlood'),
    center: centre,
    duration: PRACTICE_SECONDS,
    members: teammates(at, user),
    steps: [
      ...introductions({
        [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'vehicle'], battery: 80 },
        [JORDI]: { profile: 'firefighters', equipment: ['rope', 'light'], battery: 58 },
        [LUIS]: { profile: 'volunteer', equipment: ['blankets', 'water'], battery: 93 },
        [MARTA]: { profile: 'medical', equipment: ['first-aid', 'stretcher'], battery: 67 },
      }),
      step(3, CARMEN, { type: 'chat', text: t('practiceFloodArrived') }),
      meetingPoint(t, at, 'practiceMeetingPoint'),
      step(12, JORDI, {
        type: 'marker',
        id: 'flooded-street',
        symbol: SymbolCode.FLOOD,
        label: t('practiceFloodStreet'),
        where: at(150, 40),
      }),
      step(14, JORDI, { type: 'chat', text: t('practiceFloodStreetChat') }),
      step(18, organiser, {
        type: 'shape',
        id: FLOODED,
        style: ShapeStyleCode.DANGER,
        label: t('practiceFloodArea'),
        geometry: {
          kind: 'polygon',
          points: [at(110, -60), at(110, 130), at(240, 130), at(240, -60)],
        },
      }),
      step(22, LUIS, {
        type: 'shape',
        id: EVACUATION,
        style: ShapeStyleCode.ROUTE,
        label: t('practiceEvacuation'),
        geometry: { kind: 'polyline', points: [at(120, -160), at(-20, -160), at(-150, -260)] },
      }),
      step(26, JORDI, {
        type: 'marker',
        id: 'blocked',
        symbol: SymbolCode.BLOCKED_ROAD,
        label: t('practiceBlocked'),
        where: at(100, 200),
      }),
      ...(user === 'member'
        ? [
            ...teams(t),
            step(34, CARMEN, {
              type: 'task',
              id: 'warn-neighbours',
              text: t('practiceFloodWarnNeighbours'),
              assignee: NORTH,
              place: { kind: 'object', id: FLOODED },
            }),
            step(36, CARMEN, {
              type: 'task',
              id: 'check-route',
              text: t('practiceFloodCheckRoute'),
              assignee: SOUTH,
              place: { kind: 'object', id: EVACUATION },
            }),
            step(40, CARMEN, {
              type: 'task',
              id: 'underpass',
              text: t('practiceFloodUnderpass'),
              assignee: YOU,
              place: { kind: 'point', at: at(-30, 180) },
            }),
            step(45, CARMEN, { type: 'chat', text: t('practiceOrders') }),
          ]
        : [
            step(30, LUIS, { type: 'chat', text: t('practiceFloodAreaReady') }),
            step(45, JORDI, { type: 'chat', text: t('practiceAwaitingOrders') }),
          ]),
      ...martasSos(t, { kind: 'trapped', text: 'practiceFloodSos' }, JORDI),
      ...(user === 'member'
        ? warningAndRollCall(t, { level: 'critical', text: 'practiceFloodWarning' })
        : []),
      step(360, LUIS, {
        type: 'report',
        incident: 'flood',
        hazards: ['water', 'electricity'],
        access: 'difficult',
        casualties: { red: null, yellow: 1, green: 3, black: null },
        resources: ['rescue', 'machinery'],
        note: t('practiceFloodReport'),
      }),
    ],
  };
}
