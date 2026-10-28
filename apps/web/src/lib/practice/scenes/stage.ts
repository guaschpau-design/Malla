// What every practice situation shares: four simulated teammates who gather a little south-west of
// the user, tell the team about themselves, mark the meeting point and, when the user is a member,
// a coordinator among them who forms the teams, hands out the work, warns and calls the roll. One
// of them, Marta, calls an SOS that another answers by going to her. Everything is placed around a
// point in metres, then kept to the streets by the practice run (@tesel/scenario's onFoot).

import { offsetMeters } from '@tesel/core';
import {
  SymbolCode,
  type DutyStatus,
  type Equipment,
  type LatLon,
  type Profile,
  type Role,
  type SosKind,
} from '@tesel/protocol';
import { YOU, type ScenarioAction, type ScenarioMember, type ScenarioStep } from '@tesel/scenario';

import type { MessageKey, Translate } from '../../i18n/index.ts';

/** The teammates, by alias: names, so the same in every language. */
export const CARMEN = 'Carmen';
export const JORDI = 'Jordi';
export const LUIS = 'Luis';
export const MARTA = 'Marta';

/** The teams the coordinator forms when the user is a member, by the scenario's names. */
export const NORTH = 'north';
export const SOUTH = 'south';

/** Ids of what the shared steps create, for the situations' own steps to refer to. */
export const MEETING_POINT = 'meeting-point';
const MARTA_SOS = 'marta-sos';

/** A brisk walk, in metres per second: they are on a search, not a stroll. */
const PACE = 1.4;

/** Seconds a practice lasts at most: its run moves the members, not the plan. */
export const PRACTICE_SECONDS = 3600;

/** A point `north` and `east` metres from where the practice takes place. */
export type Place = (north: number, east: number) => LatLon;

export function placeAround(centre: LatLon): Place {
  return (north, east) => offsetMeters(centre, north, east);
}

/** One step of a scenario. */
export function step(at: number, by: string, action: ScenarioAction): ScenarioStep {
  return { at, by, action };
}

/**
 * The teammates, gathered at the meeting point: Carmen coordinates when the user is a member, and
 * is one more member when the user coordinates.
 */
export function teammates(at: Place, user: Role): ScenarioMember[] {
  return [
    {
      alias: CARMEN,
      role: user === 'member' ? 'coordinator' : 'member',
      route: [at(-60, -80)],
      speed: PACE,
    },
    { alias: JORDI, route: [at(-40, -55)], speed: PACE },
    { alias: LUIS, route: [at(-85, -60)], speed: PACE },
    { alias: MARTA, route: [at(-60, -115)], speed: PACE },
  ];
}

interface Self {
  readonly profile: Profile;
  readonly equipment: readonly Equipment[];
  readonly battery: number;
  readonly status?: DutyStatus;
}

/** What each teammate tells about themselves as they arrive. */
export function introductions(selves: Readonly<Record<string, Self>>): ScenarioStep[] {
  return Object.entries(selves).map(([alias, self]) =>
    step(1, alias, {
      type: 'state',
      profile: self.profile,
      status: self.status ?? 'active',
      battery: self.battery,
      equipment: self.equipment,
    }),
  );
}

/** Carmen marks where everyone gathers. */
export function meetingPoint(t: Translate, at: Place, label: MessageKey): ScenarioStep {
  return step(6, CARMEN, {
    type: 'marker',
    id: MEETING_POINT,
    symbol: SymbolCode.MEETING_POINT,
    label: t(label),
    where: at(-60, -80),
  });
}

/**
 * When the user is a member: Carmen forms the north team (Jordi and the user) and the south team
 * (Luis and Marta).
 */
export function teams(t: Translate): ScenarioStep[] {
  return [
    step(24, CARMEN, {
      type: 'team',
      id: NORTH,
      name: t('practiceTeamNorth'),
      colour: 'blue',
      members: [JORDI, YOU],
    }),
    step(25, CARMEN, {
      type: 'team',
      id: SOUTH,
      name: t('practiceTeamSouth'),
      colour: 'orange',
      members: [LUIS, MARTA],
    }),
  ];
}

/**
 * Marta calls an SOS and a teammate answers it, saying they are on their way; the practice run
 * walks them to her and, once there, Marta's SOS ends.
 */
export function martasSos(
  t: Translate,
  sos: { readonly kind: SosKind; readonly text: MessageKey },
  helper: string,
): ScenarioStep[] {
  return [
    step(110, MARTA, { type: 'sos', id: MARTA_SOS, kind: sos.kind, text: t(sos.text) }),
    step(150, helper, { type: 'ack', of: MARTA_SOS }),
    step(152, helper, { type: 'chat', text: t('practiceGoingToMarta') }),
  ];
}

/** When the user is a member: Carmen warns everyone and, a while later, calls the roll. */
export function warningAndRollCall(
  t: Translate,
  warning: { readonly level: 'info' | 'warning' | 'critical'; readonly text: MessageKey },
): ScenarioStep[] {
  return [
    step(220, CARMEN, { type: 'alert', level: warning.level, text: t(warning.text) }),
    step(300, CARMEN, { type: 'roll-call' }),
  ];
}
