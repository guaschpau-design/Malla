// A mountain outing: a club's group of hikers climbs from the trailhead, where the map was when the
// practice started, up the paths to the top (mountain-route.ts), with storms forecast for later
// (mountain-world.ts). Carmen draws the route and marks the trailhead and the top. With the user
// as a member, Carmen guides the group and turns it back at the first thunder, and asks the user to
// call the rescue when someone slips; with the user as coordinator, they guide it, and all that is
// theirs to decide.

import { simplifyLine } from '@tesel/core';
import { SHAPE_MAX_POINTS, ShapeStyleCode, SymbolCode } from '@tesel/protocol';

import type { Exercise, Setting } from '../exercise.ts';
import {
  CARMEN,
  cast,
  EXERCISE_SECONDS,
  introductions,
  JORDI,
  LUIS,
  MARTA,
  MEETING_POINT,
  NURIA,
  PABLO,
  personas,
  placeAround,
  SARA,
  sosToPractise,
  step,
} from './cast.ts';
import { mountainFindings } from './mountain-findings.ts';
import { MountainRoute } from './mountain-route.ts';
import { MountainWorld } from './mountain-world.ts';

/** Ids of the outing's objects. */
const ROUTE = 'route';
const TOP = 'top';

/** Whether the place has a mountain to climb, with paths up it: what the outing needs. */
export function suitsMountain(setting: Pick<Setting, 'ground' | 'centre'>): boolean {
  return MountainRoute.from(setting.ground, setting.centre) !== null;
}

export function mountain(setting: Setting): Exercise {
  const { t, centre, user, ground } = setting;
  const route = MountainRoute.from(ground, centre);
  // The practice starts the outing only where suitsMountain holds.
  if (route === null) throw new Error('no mountain to climb here');
  const at = placeAround(centre);
  const world = new MountainWorld(setting, route);
  const people = personas({
    [CARMEN]: { profile: 'volunteer', equipment: ['radio', 'lora', 'first-aid'] },
    [JORDI]: { profile: 'volunteer', equipment: ['light'] },
    [LUIS]: { profile: 'rescue', equipment: ['rope', 'radio'] },
    [MARTA]: { profile: 'medical', equipment: ['first-aid', 'blankets'] },
    [NURIA]: { profile: 'volunteer', equipment: ['radio', 'lora'] },
    [PABLO]: { profile: 'volunteer', equipment: ['light', 'water'] },
    [SARA]: { profile: 'volunteer', equipment: ['water'] },
  });
  const about = {
    height: Math.round(route.high),
    rise: Math.round(route.high - route.low),
    distance: Math.round(route.length / 100) / 10,
  };
  const briefing = user === 'member' ? 'practiceMountainArrived' : 'practiceMountainCall';
  return {
    scenario: {
      name: 'mountain',
      description: t('practiceMountain', about),
      center: centre,
      duration: EXERCISE_SECONDS,
      members: cast(t, at, user),
      steps: [
        ...introductions(people),
        step(3, CARMEN, { type: 'chat', text: t(briefing, about) }),
        step(6, CARMEN, {
          type: 'marker',
          id: MEETING_POINT,
          symbol: SymbolCode.MEETING_POINT,
          label: t('practiceMountainTrailhead'),
          where: route.pointAt(0),
        }),
        step(8, CARMEN, {
          type: 'shape',
          id: ROUTE,
          style: ShapeStyleCode.ROUTE,
          label: t('practiceMountainRoute'),
          geometry: { kind: 'polyline', points: simplifyLine(route.way, SHAPE_MAX_POINTS).points },
        }),
        step(9, CARMEN, {
          type: 'marker',
          id: TOP,
          symbol: SymbolCode.GENERIC,
          label: t('practiceMountainTop', { height: about.height }),
          where: route.top,
        }),
      ],
    },
    personas: people,
    world,
    injects: [sosToPractise(t, 420, { kind: 'general', text: 'practiceMountainSos' })],
    findings: mountainFindings(world),
    seconds: EXERCISE_SECONDS,
  };
}
