// The practice: a search around where the user is, with four simulated teammates who walk their
// sectors, mark what they find, talk in the chat and, two minutes in, one of them calls an SOS for
// the user to acknowledge and follow. Built around a point, in the user's language.

import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Scenario } from '@tesel/scenario';

import type { Translate } from '../i18n/index.ts';

// Symbol and style codes: protocol §4.
const BLOCKED_ROAD = 6;
const MEETING_POINT = 8;
const SEARCH_ASSIGNED = 2;

export function practiceScenario(t: Translate, centre: LatLon): Scenario {
  const at = (north: number, east: number) => offsetMeters(centre, north, east);
  return {
    name: 'practice',
    description: t('practiceDescription'),
    center: centre,
    duration: 15 * 60,
    members: [
      { alias: 'Jordi', route: [at(-120, -60), at(-120, 140)], speed: 0.8 },
      { alias: 'Carmen', route: [at(80, -150)] },
      { alias: 'Luis', route: [at(200, 0), at(320, 60), at(260, 200)], speed: 1 },
      { alias: 'Marta', route: [at(-40, 260), at(60, 330)], speed: 0.6 },
    ],
    steps: [
      { at: 3, by: 'Carmen', action: { type: 'chat', text: t('practiceArrived') } },
      {
        at: 8,
        by: 'Carmen',
        action: {
          type: 'marker',
          id: 'meeting-point',
          symbol: MEETING_POINT,
          label: t('practiceMeetingPoint'),
          where: at(80, -150),
        },
      },
      {
        at: 20,
        by: 'Luis',
        action: {
          type: 'shape',
          id: 'sector',
          style: SEARCH_ASSIGNED,
          label: t('practiceSector'),
          geometry: {
            kind: 'polygon',
            points: [at(180, -40), at(360, 40), at(300, 240), at(160, 160)],
          },
        },
      },
      { at: 45, by: 'Luis', action: { type: 'chat', text: t('practiceStartingSector') } },
      {
        at: 75,
        by: 'Jordi',
        action: {
          type: 'marker',
          id: 'blocked',
          symbol: BLOCKED_ROAD,
          label: t('practiceBlocked'),
          where: at(-120, 60),
        },
      },
      { at: 80, by: 'Jordi', action: { type: 'chat', text: t('practiceBlockedChat') } },
      {
        at: 120,
        by: 'Marta',
        action: { type: 'sos', id: 'marta', kind: 'medical', text: t('practiceSosText') },
      },
      { at: 200, by: 'Carmen', action: { type: 'ack', of: 'marta' } },
      { at: 205, by: 'Carmen', action: { type: 'chat', text: t('practiceGoingToMarta') } },
      { at: 420, by: 'Marta', action: { type: 'cancel-sos', of: 'marta' } },
      { at: 425, by: 'Carmen', action: { type: 'chat', text: t('practiceMartaSafe') } },
    ],
  };
}
