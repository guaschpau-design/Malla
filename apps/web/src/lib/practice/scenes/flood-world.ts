// What a flood does (flood-water.ts): the water rises out of the stream of the map nearest to the
// place (a ravine where there is none) and spreads, and whoever is on the ground draws it on the map
// as it grows. Homes stand in its way (flood-homes.ts). The lowest underpass floods early, and a car
// gets caught in it unless someone has closed it. Whoever finds the water rising round them gets
// out; whoever is caught by it calls for help. The evacuation route may be cut.

import {
  bearingDegrees,
  distanceMeters,
  nearestOnSegment,
  offsetMeters,
  simplifyLine,
} from '@tesel/core';
import { SHAPE_MAX_POINTS, ShapeStyleCode, SymbolCode, type LatLon } from '@tesel/protocol';
import type { Passable } from '@tesel/scenario';

import type { Setting, Stage, World } from '../exercise.ts';
import type { Ground } from '../ground.ts';
import type { NamedLine } from '../../map/tiles/surroundings.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';
import { CARMEN, dispatch, EXERCISE_SECONDS, type Place } from './cast.ts';
import { BOAT_AFTER_S, FloodHomes } from './flood-homes.ts';
import { FloodWater, type Flooding } from './flood-water.ts';
import { pullBack } from './pull-back.ts';

/** Ids of the objects of the flood, for the exercise to refer to. */
const FLOODED = 'flooded-area';
export const FLOODABLE = 'floodable-area';
export const EVACUATION = 'evacuation-route';
export const UNDERPASS = 'underpass';

/** How deep someone walks into, and someone with a rope. */
const WADE_M = 0.35;
const WADE_ROPED_M = 0.9;
/** Deeper than this where someone stands, they get out of the water while they can. */
const GETS_OUT_M = 0.3;
const GETS_OUT_ROPED_M = 0.7;
/** Deeper than this where someone stands, the water takes their feet. */
const CAUGHT_M = 0.5;
const CAUGHT_ROPED_M = 1.0;
/** Water this deep at the underpass floods it; on the evacuation route, cuts it. */
const CUTS_M = 0.3;
/** Seconds between the water being worked out, and between its edge being drawn again. */
const WATER_EVERY_S = 5;
const DRAW_EVERY_S = 90;
/** How much the water must have grown or shrunk to be drawn again. */
const DRAW_CHANGE = 0.08;
/** Where the stream comes out if the map has none: this far north, wandering. */
const RAVINE_NORTH_M = 300;

export class FloodWorld implements World {
  /** The stream's name, as said in a sentence; null for a ravine the map does not name. */
  readonly river: string | null;
  readonly underpass: LatLon;
  readonly route: readonly LatLon[];
  readonly homes: FloodHomes;
  readonly #water: FloodWater;
  readonly #user: Setting['user'];
  #flood: Flooding;
  #drawn: { readonly points: number; readonly elapsed: number } | null = null;
  /** The street the water was last said to have reached. */
  #front: string | null = null;
  /** How the underpass ended: closed in time, or with a car caught in it; null while open. */
  #underpass: 'closed' | 'car' | null = null;
  #routeCut = false;
  /** Teammates the water has caught, by alias, with when, in seconds into the exercise. */
  readonly #caught = new Map<string, number>();

  constructor({ ground, chance, centre, user }: Setting, at: Place) {
    const meeting = at(-60, -80);
    const stream = streamNear(ground, centre, meeting);
    this.river = stream.name;
    const channel = stream.lines ?? [
      Array.from({ length: 29 }, (_, index) => {
        const east = -700 + index * 50;
        return at(RAVINE_NORTH_M + 25 * Math.sin(east / 130 + chance.between(0, 6)), east);
      }),
    ];
    this.#water = new FloodWater(centre, channel, ground.heights, chance);
    this.#flood = this.#water.flooding(FloodWater.level(0));
    this.#user = user;
    const spots = (ground.network?.points ?? lattice(at)).filter(
      (point) => distanceMeters(point, meeting) > 100,
    );
    this.homes = new FloodHomes(spots, this.#water, centre, chance, user);
    const homes = this.homes.places;
    const low = spots
      .filter((point) => !homes.has(point) && distanceMeters(point, centre) < 350)
      .filter((point) => this.#water.reachAt(point) > 0.4)
      .sort((a, b) => this.#water.reachAt(a) - this.#water.reachAt(b));
    this.underpass = low[0] ?? at(150, 0);
    const from = channel
      .flat()
      .reduce((nearest, point) =>
        distanceMeters(point, meeting) < distanceMeters(nearest, meeting) ? point : nearest,
      );
    const away = bearingDegrees(from, meeting) * (Math.PI / 180);
    const end = offsetMeters(meeting, 350 * Math.cos(away), 350 * Math.sin(away));
    const way = ground.network?.through([meeting, end]) ?? [meeting, end];
    this.route = simplifyLine(way, SHAPE_MAX_POINTS).points;
  }

  /** What the water will cover at its highest, as the technicians foresee it. */
  get floodable(): LatLon[] {
    return this.#water.edge(this.#water.flooding(FloodWater.level(EXERCISE_SECONDS / 2)));
  }

  /** How the underpass ended: closed in time, or with a car caught in it; null while open. */
  get underpassEnded(): 'closed' | 'car' | null {
    return this.#underpass;
  }

  /** How many teammates the water caught. */
  get caught(): number {
    return this.#caught.size;
  }

  passable(who: Teammate): Passable {
    const deepest = who.has('rope') ? WADE_ROPED_M : WADE_M;
    return (at) => this.#water.depthAt(at, this.#flood) < deepest;
  }

  tick(stage: Stage): void {
    if (stage.once(`water ${String(Math.floor(stage.elapsed / WATER_EVERY_S))}`)) {
      this.#flood = this.#water.flooding(FloodWater.level(stage.elapsed));
    }
    this.#draw(stage);
    this.homes.tick(stage, (at) => this.#water.depthAt(at, this.#flood));
    this.#checkUnderpass(stage);
    this.#checkRoute(stage);
    this.#catch(stage);
    this.#end(stage);
  }

  /** Whoever is nearest the water draws its edge, first and whenever it has moved on. */
  #draw(stage: Stage): void {
    const { points } = this.#flood;
    const last = this.#drawn;
    if (last === null ? stage.elapsed < 20 : stage.elapsed - last.elapsed < DRAW_EVERY_S) return;
    if (last !== null && Math.abs(points - last.points) / last.points < DRAW_CHANGE) return;
    const edge = this.#water.edge(this.#flood);
    if (edge.length < 3) return;
    this.#drawn = { points, elapsed: stage.elapsed };
    const front = edge.reduce((nearest, point) =>
      distanceMeters(point, landmarkOf(stage).at) < distanceMeters(nearest, landmarkOf(stage).at)
        ? point
        : nearest,
    );
    const drawer = stage.crew.nearest(front, (who) => !who.silent) ?? stage.crew.lead;
    stage.act(drawer.alias, {
      type: 'shape',
      id: FLOODED,
      style: ShapeStyleCode.DANGER,
      label: stage.t('practiceFloodArea'),
      geometry: { kind: 'polygon', points: edge },
    });
    // The water is said to have reached a street once: when it is a new one.
    const street = stage.ground.streetAt(front);
    if (last === null || street === null || street === this.#front) return;
    this.#front = street;
    const saying = points > last.points ? 'practiceFloodSpreads' : 'practiceFloodRecedes';
    stage.say(drawer.alias, stage.t(saying, { street }));
  }

  /** The underpass floods first: closed by whoever got there before, or a car gets caught. */
  #checkUnderpass(stage: Stage): void {
    if (this.#underpass !== null) return;
    const there = stage.crew.onTheGround.find(
      (who) => !who.silent && who.distanceTo(this.underpass, stage.now) <= 30,
    );
    const checked = there !== undefined || this.#userChecked(stage);
    const flooded = this.#water.depthAt(this.underpass, this.#flood) >= CUTS_M;
    if (!checked && !flooded) return;
    this.#underpass = checked ? 'closed' : 'car';
    const by = there?.alias ?? dispatch(stage.t);
    stage.act(by, {
      type: 'marker',
      id: UNDERPASS,
      symbol: SymbolCode.BLOCKED_ROAD,
      label: stage.t('practiceFloodUnderpassShut'),
      where: this.underpass,
    });
    const where = stage.ground.where(stage.t, this.underpass, landmarkOf(stage));
    if (checked) {
      if (there !== undefined) stage.say(there.alias, stage.t('practiceFloodUnderpassClosed'));
      return;
    }
    stage.say(dispatch(stage.t), stage.t('practiceFloodUnderpassCar', { where }));
  }

  /** Whether the user has done the task of checking the underpass, which Carmen gave them. */
  #userChecked(stage: Stage): boolean {
    return [...stage.state.tasks.values()].some(
      (task) =>
        task.status === 'done' &&
        task.origin === stage.user.node &&
        task.text === stage.t('practiceFloodUnderpass'),
    );
  }

  /** Whoever walks the evacuation route and finds water on it says it is cut. */
  #checkRoute(stage: Stage): void {
    if (this.#routeCut) return;
    const cut = this.route.find((point) => this.#water.depthAt(point, this.#flood) >= CUTS_M);
    if (cut === undefined) return;
    const finder = stage.crew.onTheGround.find(
      (who) => !who.silent && who.distanceTo(cut, stage.now) <= 40,
    );
    if (finder === undefined) return;
    this.#routeCut = true;
    const where = stage.ground.where(stage.t, cut, landmarkOf(stage));
    stage.say(finder.alias, stage.t('practiceFloodRouteCut', { where }));
    if (this.#user === 'member')
      stage.after(30, () => {
        this.#redrawRoute(stage);
      });
  }

  /** Carmen draws a new evacuation route, clear of the water, if there is one. */
  #redrawRoute(stage: Stage): void {
    const [start] = this.route;
    const end = this.route.at(-1);
    if (start === undefined || end === undefined) return;
    const dry = (at: LatLon) => this.#water.depthAt(at, this.#flood) < 0.1;
    const way = stage.ground.network?.through([start, end], dry);
    if (!way) {
      stage.say(CARMEN, stage.t('practiceFloodNoRoute'));
      return;
    }
    stage.act(CARMEN, {
      type: 'shape',
      id: EVACUATION,
      style: ShapeStyleCode.ROUTE,
      label: stage.t('practiceEvacuation'),
      geometry: { kind: 'polyline', points: simplifyLine(way, SHAPE_MAX_POINTS).points },
    });
    stage.say(CARMEN, stage.t('practiceFloodRouteChanged'));
  }

  /**
   * Whoever finds the water rising round them gets out while they can; whoever stands in water too
   * deep for them is caught, and calls for help.
   */
  #catch(stage: Stage): void {
    for (const who of stage.crew.onTheGround) {
      if (this.#caught.has(who.alias) || who.silent) continue;
      const roped = who.has('rope');
      const depth = this.#water.depthAt(who.at(stage.now), this.#flood);
      const gettingOut = who.job?.kind === 'scene';
      if (depth >= (roped ? GETS_OUT_ROPED_M : GETS_OUT_M) && !gettingOut) {
        const where = stage.ground.where(stage.t, who.at(stage.now), landmarkOf(stage));
        if (pullBack(stage, who, stage.t('practiceFloodGettingOut'))) {
          stage.say(who.alias, stage.t('practiceFloodGetOut', { where }));
          continue;
        }
      }
      if (depth < (roped ? CAUGHT_ROPED_M : CAUGHT_M)) continue;
      this.#caught.set(who.alias, stage.elapsed);
      const where = stage.ground.where(stage.t, who.at(stage.now), landmarkOf(stage));
      const text = stage.t('practiceFloodCaught', { where });
      stage.act(who.alias, { type: 'sos', id: `caught-${who.alias}`, kind: 'trapped', text });
    }
    for (const [alias, since] of this.#caught) {
      const who = stage.crew.byAlias(alias);
      if (who?.hurt !== true || stage.elapsed - since < BOAT_AFTER_S) continue;
      if (!stage.once(`boat ${alias}`)) continue;
      stage.say(dispatch(stage.t), stage.t('practiceFloodBoatTeammate', { name: alias }));
      stage.act(alias, { type: 'cancel-sos', of: `caught-${alias}` });
    }
  }

  /** At the end, or once the water falls with everyone safe, the exercise is over. */
  #end(stage: Stage): void {
    const safe = this.homes.safe && stage.crew.all.every((who) => !who.hurt);
    if (stage.elapsed < EXERCISE_SECONDS && !(safe && stage.elapsed >= 1320)) return;
    const { warned, homes } = this.homes.tally;
    stage.finish(stage.t('practiceFloodEnd', { warned, homes }));
  }
}

/**
 * The stream nearest to the place, by its name (all its pieces), if the map has one within reach
 * that is not so close to the meeting point that the team would start under water.
 */
function streamNear(
  ground: Ground,
  centre: LatLon,
  meeting: LatLon,
): { readonly lines: LatLon[][] | null; readonly name: string | null } {
  const away = (line: NamedLine, from: LatLon) => lineDistance(line.points, from);
  const reachable = ground.waterways.filter(
    (line) => away(line, centre) < 600 && away(line, meeting) > 150,
  );
  const [nearest] = reachable.sort((a, b) => away(a, centre) - away(b, centre));
  if (nearest === undefined) return { lines: null, name: null };
  const same = reachable.filter(
    (line) => line === nearest || (line.name !== null && line.name === nearest.name),
  );
  return { lines: same.map((line) => [...line.points]), name: nearest.name };
}

/** Metres from a point to the nearest point of a line. */
function lineDistance(line: readonly LatLon[], from: LatLon): number {
  return line
    .slice(1)
    .reduce(
      (nearest, b, index) => Math.min(nearest, nearestOnSegment(from, line[index] ?? b, b).meters),
      Infinity,
    );
}

/** Points every 40 m round the place, where the map has no streets to stand homes on. */
function lattice(at: Place): LatLon[] {
  return Array.from({ length: 31 * 31 }, (_, index) =>
    at(-600 + Math.floor(index / 31) * 40, -600 + (index % 31) * 40),
  );
}
