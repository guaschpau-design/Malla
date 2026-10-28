// A missing person: an elderly woman who went for a walk and has not come back. Her last known
// place is marked and a search sector drawn north-east of the meeting point. With the user as a
// member, Carmen splits the sector into two strips, one for each team, and asks the user to ask
// around nearby; with the user as coordinator, the sector waits for the user to plan its sweep.

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
  type Place,
} from './stage.ts';

const SECTOR = 'sector';

export function missingPerson(t: Translate, centre: LatLon, user: Role): Scenario {
  const at: Place = placeAround(centre);
  const organiser = user === 'member' ? CARMEN : LUIS;
  return {
    name: 'missing-person',
    description: t('practiceMissingPerson'),
    center: centre,
    duration: PRACTICE_SECONDS,
    members: teammates(at, user),
    steps: [
      ...introductions({
        [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'light'], battery: 86 },
        [JORDI]: { profile: 'volunteer', equipment: ['light', 'water'], battery: 64 },
        [LUIS]: { profile: 'rescue', equipment: ['rope', 'radio', 'light'], battery: 91 },
        [MARTA]: { profile: 'medical', equipment: ['first-aid', 'blankets'], battery: 72 },
      }),
      step(3, CARMEN, { type: 'chat', text: t('practiceMissingArrived') }),
      meetingPoint(t, at, 'practiceMeetingPoint'),
      step(12, LUIS, {
        type: 'marker',
        id: 'last-seen',
        symbol: SymbolCode.MISSING,
        label: t('practiceMissingLastSeen'),
        where: at(160, 60),
      }),
      step(18, organiser, {
        type: 'shape',
        id: SECTOR,
        style: ShapeStyleCode.SEARCH_ASSIGNED,
        label: t('practiceMissingSector'),
        geometry: {
          kind: 'polygon',
          points: [at(110, -10), at(110, 160), at(260, 160), at(260, -10)],
        },
      }),
      ...(user === 'member'
        ? [
            ...teams(t),
            ...[0, 1].map((strip) =>
              step(30 + strip, CARMEN, {
                type: 'sweep',
                id: `strip-${String(strip)}`,
                area: SECTOR,
                spacing: 40,
                heading: 0,
                strip,
                strips: 2,
              }),
            ),
            step(34, CARMEN, {
              type: 'task',
              id: 'north-strip',
              text: t('practiceMissingStrip', { strip: 1 }),
              assignee: NORTH,
              place: { kind: 'object', id: 'strip-0' },
            }),
            step(36, CARMEN, {
              type: 'task',
              id: 'south-strip',
              text: t('practiceMissingStrip', { strip: 2 }),
              assignee: SOUTH,
              place: { kind: 'object', id: 'strip-1' },
            }),
            step(40, CARMEN, {
              type: 'task',
              id: 'ask-around',
              text: t('practiceMissingAskAround'),
              assignee: YOU,
              place: { kind: 'point', at: at(40, 120) },
            }),
            step(45, CARMEN, { type: 'chat', text: t('practiceOrders') }),
          ]
        : [
            step(30, LUIS, { type: 'chat', text: t('practiceMissingSectorReady') }),
            step(45, JORDI, { type: 'chat', text: t('practiceAwaitingOrders') }),
          ]),
      ...martasSos(t, { kind: 'medical', text: 'practiceMissingSos' }, CARMEN),
      ...(user === 'member'
        ? warningAndRollCall(t, { level: 'info', text: 'practiceMissingWarning' })
        : []),
      step(360, LUIS, {
        type: 'report',
        incident: 'missing-person',
        hazards: [],
        access: 'difficult',
        casualties: { red: null, yellow: null, green: null, black: null },
        resources: ['rescue'],
        note: t('practiceMissingReport'),
      }),
      step(420, JORDI, {
        type: 'state',
        profile: 'volunteer',
        status: 'active',
        battery: 21,
        equipment: ['light', 'water'],
      }),
    ],
  };
}
