// What a wildfire does (fire-front.ts): it starts in the scrub north of the place and the wind
// drives it towards the houses; twelve minutes in, the wind turns, and it heads for others; the
// aircraft slow it down at eighteen. Whoever is nearest to it draws it on the map as it grows. The
// houses it will threaten are known from the start of its spread: the team empties those it
// passes. One it comes near before anyone has is a family that has not left, which someone must
// get out, or the forest firefighters do, too late for comfort. Whoever is close to it pulls back,
// as people do in smoke; whoever it catches calls for help.

import { bearingDegrees, distanceMeters } from '@tesel/core';
import { ShapeStyleCode, SymbolCode, type LatLon } from '@tesel/protocol';
import type { Passable } from '@tesel/scenario';

import type { Setting, Stage, World } from '../exercise.ts';
import { heading } from '../ground.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';
import { CallOut } from './call-out.ts';
import { CARMEN, dispatch, EXERCISE_SECONDS, NURIA, type Place } from './cast.ts';
import { FireFront } from './fire-front.ts';
import { pullBack } from './pull-back.ts';

/** Ids of the objects of the fire, for the exercise to refer to. */
const FIRE = 'fire';
export const AT_RISK = 'area-at-risk';

/** When the wind turns, and when the aircraft start working on the fire. */
export const WIND_TURNS_S = 720;
export const AIRCRAFT_S = 1080;
/** How fast the fire's head runs before and after the wind turns, and under the aircraft. */
const SPEEDS = [0.3, 0.38, 0.09] as const;
/** How far the wind turns, clockwise, in degrees. */
const TURN_DEG = 70;
/**
 * Nobody walks closer to the fire than this; closer, they pull back, unless they are getting a
 * family out; closer still, it catches them.
 */
const KEEPS_CLEAR_M = 40;
const PULLS_BACK_M = 70;
const CATCHES_M = 20;
/** How often someone pulls back, and says so, at most. */
const PULLS_BACK_EVERY_S = 120;
const SAYS_SO_EVERY_S = 240;
/** The fire this close to a house that has not been emptied traps whoever is in it. */
const THREATENS_M = 150;
/** Someone this close to a house empties it. */
const EMPTIES_M = 35;
const HOUSES = 9;
const HOUSES_APART_M = 60;
/** Seconds between the fire being drawn again, and how far ahead the area at risk looks. */
const DRAW_EVERY_S = 60;
const RISK_AHEAD_S = 600;
const RISK_BEYOND_M = 100;

interface House {
  readonly at: LatLon;
  readonly id: string;
  /** Its number in the street, as people call it. */
  readonly number: number;
  emptied: boolean;
  trapped: CallOut | null;
  ended: 'rescued' | 'firefighters' | null;
}

export class WildfireWorld implements World {
  readonly #fire: FireFront;
  readonly #houses: House[];
  readonly #user: Setting['user'];
  /** When each teammate last pulled back from the fire, in seconds into the exercise. */
  readonly #pulledBack = new Map<Teammate, number>();
  readonly #caught = new Set<Teammate>();
  /** Seconds into the exercise the fire was last worked out for. */
  #elapsed = 0;

  constructor({ ground, chance, centre, user }: Setting, at: Place) {
    const start = at(450, -150);
    const towards = (bearingDegrees(start, centre) + chance.between(10, 30) + 360) % 360;
    this.#fire = new FireFront(
      start,
      [
        { from: 0, towards, speed: SPEEDS[0] },
        { from: WIND_TURNS_S, towards: (towards - TURN_DEG + 360) % 360, speed: SPEEDS[1] },
        { from: AIRCRAFT_S, towards: (towards - TURN_DEG + 360) % 360, speed: SPEEDS[2] },
      ],
      chance,
    );
    this.#user = user;
    const meeting = at(-60, -80);
    const spots = (ground.network?.points ?? []).filter(
      (point) => distanceMeters(point, meeting) > 120 && this.#fire.distanceTo(point, 0) > 150,
    );
    const threatened = spots
      .map((point) => ({ point, when: this.#fire.reaches(point, THREATENS_M, EXERCISE_SECONDS) }))
      .filter(({ when }) => when !== null && when > 240 && when < EXERCISE_SECONDS - 120)
      .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));
    const houses: LatLon[] = [];
    for (const { point } of threatened) {
      if (houses.length === HOUSES) break;
      if (houses.every((house) => distanceMeters(house, point) >= HOUSES_APART_M))
        houses.push(point);
    }
    this.#houses = houses.map((house, index) => ({
      at: house,
      id: `house-${String(index)}`,
      number: Math.round(chance.between(1, 60)),
      emptied: false,
      trapped: null,
      ended: null,
    }));
  }

  /**
   * How the houses fared, of how many: emptied in time, or reached by the fire first, and then
   * their people got out by the team or by the firefighters.
   */
  get tally(): {
    emptied: number;
    trapped: number;
    rescued: number;
    firefighters: number;
    houses: number;
  } {
    const count = (fared: (house: House) => boolean) => this.#houses.filter(fared).length;
    return {
      emptied: count((house) => house.emptied),
      trapped: count((house) => house.trapped !== null),
      rescued: count((house) => house.ended === 'rescued'),
      firefighters: count((house) => house.ended === 'firefighters'),
      houses: this.#houses.length,
    };
  }

  /** How many teammates the fire caught. */
  get caught(): number {
    return this.#caught.size;
  }

  /** The way the fire runs now, in words. */
  heading(stage: Stage): string {
    return heading(stage.t, this.#fire.phaseAt(stage.elapsed)?.towards ?? 0);
  }

  /** The area the fire may reach in the next ten minutes, with a margin. */
  atRisk(stage: Stage): LatLon[] {
    return this.#fire.edge(stage.elapsed + RISK_AHEAD_S, RISK_BEYOND_M);
  }

  passable(): Passable {
    return (at) => this.#fireAt(at) > KEEPS_CLEAR_M;
  }

  #fireAt(at: LatLon): number {
    return this.#fire.distanceTo(at, this.#elapsed);
  }

  tick(stage: Stage): void {
    this.#elapsed = stage.elapsed;
    this.#draw(stage);
    for (const house of this.#houses) this.#house(stage, house);
    this.#keepAway(stage);
    this.#end(stage);
  }

  /** Nuria, a firefighter, draws the fire, first and then each minute, if she can. */
  #draw(stage: Stage): void {
    if (stage.elapsed < 20) return;
    if (!stage.once(`draw ${String(Math.floor(stage.elapsed / DRAW_EVERY_S))}`)) return;
    const nuria = stage.crew.byAlias(NURIA);
    const drawer = nuria?.onFoot === true && !nuria.silent ? nuria : stage.crew.lead;
    stage.act(drawer.alias, {
      type: 'shape',
      id: FIRE,
      style: ShapeStyleCode.DANGER,
      label: stage.t('practiceFireFront'),
      geometry: { kind: 'polygon', points: this.#fire.edge(stage.elapsed) },
    });
  }

  #house(stage: Stage, house: House): void {
    if (house.ended !== null) return;
    const said = () => ({
      number: house.number,
      where: stage.ground.address(stage.t, house.at, landmarkOf(stage)),
    });
    if (!house.emptied && house.trapped === null) {
      const emptier = stage.crew.onTheGround.find(
        (who) => !who.silent && who.distanceTo(house.at, stage.now) <= EMPTIES_M,
      );
      if (emptier !== undefined) {
        house.emptied = true;
        const people = Math.round(stage.chance.between(2, 4));
        stage.say(emptier.alias, stage.t('practiceFireEmptied', { ...said(), people }));
        return;
      }
      if (this.#fireAt(house.at) > THREATENS_M) return;
      house.trapped = new CallOut(house.at, { people: 1, seconds: 60 });
      this.#mark(stage, dispatch(stage.t), house, 'practiceFireHouseLabel', SymbolCode.HAZARD);
      stage.say(dispatch(stage.t), stage.t('practiceFireTrapped', said()));
      if (this.#user === 'member') this.#sendSomeone(stage, house, said());
      return;
    }
    if (house.trapped === null) return;
    const [rescuer] = house.trapped.tick(stage) ?? [];
    if (rescuer !== undefined) {
      house.ended = 'rescued';
      stage.say(rescuer.alias, stage.t('practiceFireRescued', said()));
      this.#mark(stage, rescuer.alias, house, 'practiceFireHouseSafe', SymbolCode.SHELTER);
      return;
    }
    if (this.#fireAt(house.at) > 0) return;
    house.ended = 'firefighters';
    stage.say(dispatch(stage.t), stage.t('practiceFireFirefighters', said()));
    if (this.#user === 'member') {
      stage.act(CARMEN, { type: 'task-status', of: `get-out-${house.id}`, status: 'cancelled' });
      stage.say(CARMEN, stage.t('practiceFireCancelGetOut'));
    }
  }

  #mark(
    stage: Stage,
    by: string,
    house: House,
    label: 'practiceFireHouseLabel' | 'practiceFireHouseSafe',
    symbol: number,
  ): void {
    stage.act(by, {
      type: 'marker',
      id: house.id,
      symbol,
      label: stage.t(label, { number: house.number }),
      where: house.at,
    });
  }

  /** When the user is a member, Carmen sends whoever is free and nearest to the house. */
  #sendSomeone(stage: Stage, house: House, said: { number: number; where: string }): void {
    stage.after(15, () => {
      const can = (one: Teammate) => !one.coordinates && !one.silent;
      const who =
        stage.crew.nearest(house.at, (one) => one.free && can(one)) ??
        stage.crew.nearest(house.at, can);
      stage.act(CARMEN, {
        type: 'task',
        id: `get-out-${house.id}`,
        text: stage.t('practiceFireGetOut', said),
        assignee: who?.alias ?? null,
        place: { kind: 'object', id: house.id },
      });
      stage.say(CARMEN, stage.t('practiceFireSendSomeone', { name: who?.alias ?? '' }));
    });
  }

  /** Whoever is close to the fire pulls back to the meeting point; whoever it catches calls for help. */
  #keepAway(stage: Stage): void {
    for (const who of stage.crew.onTheGround) {
      const away = this.#fireAt(who.at(stage.now));
      const where = () => stage.ground.where(stage.t, who.at(stage.now), landmarkOf(stage));
      if (away <= CATCHES_M && !this.#caught.has(who)) {
        this.#caught.add(who);
        const text = stage.t('practiceFireCaught', { where: where() });
        stage.act(who.alias, { type: 'sos', id: `caught-${who.alias}`, kind: 'fire', text });
        continue;
      }
      if (away > PULLS_BACK_M || who.job?.kind === 'help' || this.#rescuing(stage, who)) continue;
      const last = this.#pulledBack.get(who) ?? -Infinity;
      if (stage.elapsed - last < PULLS_BACK_EVERY_S) continue;
      this.#pulledBack.set(who, stage.elapsed);
      pullBack(stage, who, stage.t('practiceFirePullingBack'));
      if (!who.silent && stage.elapsed - last >= SAYS_SO_EVERY_S) {
        stage.say(who.alias, stage.t('practiceFirePullBack', { where: where() }));
      }
    }
  }

  /** Whether someone is at a house with a family still in it: they stay to get them out. */
  #rescuing(stage: Stage, who: Teammate): boolean {
    return this.#houses.some(
      (house) =>
        house.trapped !== null &&
        house.ended === null &&
        who.distanceTo(house.at, stage.now) <= EMPTIES_M,
    );
  }

  #end(stage: Stage): void {
    if (stage.elapsed < EXERCISE_SECONDS) return;
    const { emptied, houses } = this.tally;
    stage.finish(stage.t('practiceFireEnd', { emptied, houses }));
  }
}
