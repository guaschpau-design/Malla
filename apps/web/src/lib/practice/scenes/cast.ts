// Who is in every exercise: seven people on the ground, who gather a little south-west of the user,
// and someone at the 112 control room, who calls in what the public reports. When the user is a
// member, Carmen coordinates and forms two teams; when the user coordinates, she is one more of
// the team. Everything is placed around a point in metres, then kept to the streets by the run
// (@tesel/scenario's onFoot).

import { offsetMeters } from '@tesel/core';
import {
  SymbolCode,
  type Equipment,
  type LatLon,
  type Profile,
  type Role,
  type SosKind,
} from '@tesel/protocol';
import { YOU, type ScenarioAction, type ScenarioMember, type ScenarioStep } from '@tesel/scenario';

import type { MessageKey, Translate } from '../../i18n/index.ts';
import type { Inject, Stage } from '../exercise.ts';
import type { Persona, Teammate } from '../teammate.ts';

/** The people on the ground, by alias: names, so the same in every language. */
export const CARMEN = 'Carmen';
export const JORDI = 'Jordi';
export const LUIS = 'Luis';
export const MARTA = 'Marta';
export const NURIA = 'Nuria';
export const PABLO = 'Pablo';
export const SARA = 'Sara';

/** The teams Carmen forms when the user is a member, by the scenario's names. */
export const NORTH = 'north';
export const SOUTH = 'south';

/** Ids of what every exercise creates, for the situations' own actions to refer to. */
export const MEETING_POINT = 'meeting-point';

/** How long an exercise lasts at most: what fits a practice on a phone, and a story's turns. */
export const EXERCISE_SECONDS = 25 * 60;

/** A brisk walk, in metres per second: they are on a search, not a stroll. */
const PACE = 1.4;

/**
 * Each one's phone, and Pablo's legs: the battery they start with, the percent it loses a minute
 * (Jordi's old phone runs low by the end) and when they ask for a break.
 */
const BODIES: Readonly<Record<string, Pick<Persona, 'battery' | 'drain' | 'tires'>>> = {
  [CARMEN]: { battery: 84, drain: 0.15 },
  [JORDI]: { battery: 26, drain: 0.6 },
  [LUIS]: { battery: 91, drain: 0.12 },
  [MARTA]: { battery: 72, drain: 0.2 },
  [NURIA]: { battery: 88, drain: 0.15 },
  [PABLO]: { battery: 64, drain: 0.25, tires: 11 },
  [SARA]: { battery: 79, drain: 0.2 },
};

/** A point `north` and `east` metres from where the exercise takes place. */
export type Place = (north: number, east: number) => LatLon;

export function placeAround(centre: LatLon): Place {
  return (north, east) => offsetMeters(centre, north, east);
}

/** One step of a scenario. */
export function step(at: number, by: string, action: ScenarioAction): ScenarioStep {
  return { at, by, action };
}

/** The alias of the 112 control room, in the user's language. */
export function dispatch(t: Translate): string {
  return t('practiceDispatch');
}

/** Whoever leads the simulated side: Carmen when the user is a member, the 112 room otherwise. */
export function leader(t: Translate, user: Role): string {
  return user === 'member' ? CARMEN : dispatch(t);
}

/** Everyone, gathered at the meeting point, and the control room, which never shows on the map. */
export function cast(t: Translate, at: Place, user: Role): ScenarioMember[] {
  const gathered = (alias: string, north: number, east: number, pace = PACE): ScenarioMember => ({
    alias,
    route: [at(north, east)],
    speed: pace,
  });
  return [
    { ...gathered(CARMEN, -60, -80), role: user === 'member' ? 'coordinator' : 'member' },
    gathered(JORDI, -40, -55, 1.5),
    gathered(LUIS, -85, -60, 1.45),
    gathered(MARTA, -60, -115, 1.35),
    gathered(NURIA, -75, -100, 1.5),
    gathered(PABLO, -45, -95, 1.3),
    gathered(SARA, -90, -85, 1.4),
    { alias: dispatch(t), route: [at(-60, -80)], hidden: true },
  ];
}

/** What each one tells about themselves, from what they do and carry in this situation. */
export function personas(
  kits: Readonly<Record<string, { readonly profile: Profile; readonly equipment: Equipment[] }>>,
): Record<string, Persona> {
  return Object.fromEntries(
    Object.entries(kits).map(([alias, kit]): [string, Persona] => {
      const body = BODIES[alias] ?? { battery: 80, drain: 0.2 };
      return [alias, { ...kit, ...body }];
    }),
  );
}

/** Each one tells the team about themselves as they arrive. */
export function introductions(people: Readonly<Record<string, Persona>>): ScenarioStep[] {
  return Object.entries(people).map(([alias, persona]) =>
    step(1, alias, {
      type: 'state',
      profile: persona.profile,
      status: 'active',
      battery: persona.battery,
      equipment: persona.equipment,
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
 * When the user is a member: Carmen forms the north team (Jordi, Nuria and the user) and the south
 * team (Luis, Marta and Pablo); Sara, a nurse, stays with her.
 */
export function teams(t: Translate): ScenarioStep[] {
  return [
    step(24, CARMEN, {
      type: 'team',
      id: NORTH,
      name: t('practiceTeamNorth'),
      colour: 'blue',
      members: [JORDI, NURIA, YOU],
    }),
    step(25, CARMEN, {
      type: 'team',
      id: SOUTH,
      name: t('practiceTeamSouth'),
      colour: 'orange',
      members: [LUIS, MARTA, PABLO],
    }),
  ];
}

/**
 * An SOS to practise answering: if none of the team has called one by `at` seconds, someone out
 * on a job calls one from where they are, Marta if she can.
 */
export function sosToPractise(
  t: Translate,
  at: number,
  sos: { readonly kind: SosKind; readonly text: MessageKey },
): Inject {
  return {
    at,
    run: (stage: Stage) => {
      const called = [...stage.state.sos.values()].some((call) => stage.crew.byNode(call.origin));
      if (called) return;
      const ground = stage.crew.onTheGround;
      const out = ground.filter((teammate) => teammate.job !== null);
      const marta = (among: readonly Teammate[]) => among.find(({ alias }) => alias === MARTA);
      const who = marta(out) ?? out[0] ?? marta(ground) ?? ground[0];
      if (who === undefined) return;
      stage.act(who.alias, {
        type: 'sos',
        id: `sos-${who.alias}`,
        kind: sos.kind,
        text: t(sos.text),
      });
    },
  };
}
