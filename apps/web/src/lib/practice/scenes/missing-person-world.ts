// Where Rosa is, and what becomes of her. She went for a walk from where she was last seen and
// wandered off, as a lost elderly person does: a few hundred metres, following the streets until
// they ran out, and stopped in a park, by the water or at the end of a street. Nobody knows where:
// she is found only if someone of the team passes near enough to see her. On the way, she dropped
// her walking stick. Once found, whoever found her stays with her, the nearest teammate joins them,
// and the ambulance standing by at the meeting point drives over. If nobody has found her twenty
// minutes in, the dog unit does. Meanwhile, a neighbour falls in a doorway nearby, and waits for
// someone of the team with a first-aid kit.

import { bearingDegrees, distanceMeters, offsetMeters, pathMeters } from '@tesel/core';
import { SymbolCode, type LatLon } from '@tesel/protocol';
import { pointAlong, type Passable } from '@tesel/scenario';

import type { Setting, Stage, World } from '../exercise.ts';
import type { Ground } from '../ground.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';
import { CallOut } from './call-out.ts';
import { dispatch, leader, type Place } from './cast.ts';

/** How far she may have wandered from where she was last seen, at least and at most, in metres. */
const WANDERED_M = [280, 460] as const;
/**
 * How far either side of the way she went she may have turned off, in degrees: within a sector
 * drawn that way, as a search coordinator would draw it on hearing a witness.
 */
const TURNED_DEG = 25;
/** A point this close to a river or a stream is by the water. */
const BY_THE_WATER_M = 40;
/** Whoever passes this close sees her; up to the second distance, they may. */
const SEEN_M = 12;
const GLIMPSED_M = 30;
/** How likely someone that near is to see her, each second. */
const GLIMPSE_ODDS = 0.06;
/** Whoever passes this close finds the stick she dropped. */
const STICK_SEEN_M = 20;
/** How far along her way she dropped it. */
const STICK_ALONG = 0.55;
/** How long the ambulance standing by takes to drive to her. */
const AMBULANCE_S = 180;
/** When the dog unit arrives, if she has not been found, and when it finds her. */
const DOGS_ARRIVE_S = 1200;
const DOGS_FIND_S = 1290;
/** When the neighbour falls, and how long they wait before the ambulance is with them anyway. */
const FALL_S = 780;
const FALL_WAITS_S = 600;
/** How long a coordinating user has to send someone before a teammate offers to go. */
const FALL_OFFER_S = 90;

/** Where she ends up: what the one who finds her sees. */
type Spot = 'park' | 'water' | 'street';

export class MissingPersonWorld implements World {
  readonly lastSeen: LatLon;
  /** Which way she went, in degrees, as a witness will tell; and the other way, as her daughter guesses. */
  readonly went: number;
  readonly guessed: number;
  readonly #rosa: LatLon;
  readonly #spot: Spot;
  readonly #stick: LatLon;
  #stickFound = false;
  /** When she was found, in seconds into the exercise, and by whom; null while she is lost. */
  #found: { readonly elapsed: number; readonly by: string } | null = null;
  /** Where the neighbour falls, and the call-out once they have. */
  readonly #fallAt: LatLon;
  #fall: CallOut | null = null;

  constructor({ ground, chance }: Setting, at: Place) {
    this.lastSeen = ground.snap(at(160, 60));
    this.guessed = (45 + chance.between(-20, 20) + 360) % 360;
    this.went = (this.guessed + (chance.pick([110, 150, 210, 250]) ?? 150)) % 360;
    const { rosa, spot } = whereSheIs(ground, this.lastSeen, this.went, chance.next.bind(chance));
    this.#rosa = rosa;
    this.#spot = spot;
    const way = ground.network?.way(this.lastSeen, rosa) ?? [this.lastSeen, rosa];
    this.#stick = pointAlong(way, pathMeters(way) * STICK_ALONG);
    this.#fallAt = ground.snap(at(-230, 140));
  }

  /** The neighbour who fell; null until they have. */
  get fall(): CallOut | null {
    return this.#fall;
  }

  /** Whether she has been found, by the team or the dogs. */
  get found(): boolean {
    return this.#found !== null;
  }

  /** Nothing in this situation stands in anyone's way. */
  passable(): Passable {
    return () => true;
  }

  tick(stage: Stage): void {
    if (this.#found === null) {
      this.#lookForStick(stage);
      this.#lookForHer(stage);
      if (stage.elapsed >= DOGS_ARRIVE_S && stage.once('dogs')) {
        stage.say(dispatch(stage.t), stage.t('practiceMissingDogs'));
      }
      if (stage.elapsed >= DOGS_FIND_S) this.#foundByDogs(stage);
    }
    this.#neighbour(stage);
  }

  /** A neighbour falls, and waits for someone with a first-aid kit, or for the ambulance. */
  #neighbour(stage: Stage): void {
    if (stage.elapsed < FALL_S) return;
    if (this.#fall === null) {
      this.#fall = new CallOut(this.#fallAt, { people: 1, kit: 'first-aid', seconds: 30 });
      const where = stage.ground.address(stage.t, this.#fallAt, landmarkOf(stage));
      stage.act(dispatch(stage.t), {
        type: 'marker',
        id: 'fall',
        symbol: SymbolCode.INJURED,
        label: stage.t('practiceMissingFallLabel'),
        where: this.#fallAt,
      });
      stage.say(dispatch(stage.t), stage.t('practiceMissingFall', { where }));
      return;
    }
    if (this.#fall.seen) return;
    if (stage.elapsed >= FALL_S + FALL_WAITS_S) {
      if (stage.once('fall late')) {
        const waited = minutes(FALL_WAITS_S);
        stage.say(dispatch(stage.t), stage.t('practiceMissingFallLate', { minutes: waited }));
      }
      return;
    }
    // A coordinating user who sends nobody is offered someone with a kit, as a teammate would.
    if (stage.user.role === 'coordinator' && stage.elapsed >= FALL_S + FALL_OFFER_S) {
      const kit = stage.crew.nearest(this.#fallAt, (who) => who.has('first-aid') && !who.silent);
      if (kit !== undefined && stage.once('fall offer')) {
        stage.say(kit.alias, stage.t('practiceMissingFallOffer'));
      }
    }
    const [nurse] = this.#fall.tick(stage) ?? [];
    if (nurse !== undefined) stage.say(nurse.alias, stage.t('practiceMissingFallSeen'));
  }

  #lookForStick(stage: Stage): void {
    if (this.#stickFound) return;
    const finder = this.#near(stage, this.#stick, STICK_SEEN_M);
    if (finder === undefined) return;
    this.#stickFound = true;
    const where = stage.ground.where(stage.t, this.#stick, landmarkOf(stage));
    stage.act(finder.alias, {
      type: 'marker',
      id: 'stick',
      symbol: SymbolCode.GENERIC,
      label: stage.t('practiceMissingStick'),
      where: this.#stick,
    });
    stage.say(finder.alias, stage.t('practiceMissingStickFound', { where }));
    stage.after(20, () => {
      const answer =
        stage.user.role === 'member' ? 'practiceMissingStickHers' : 'practiceMissingStickConfirmed';
      stage.say(leader(stage.t, stage.user.role), stage.t(answer));
    });
  }

  #lookForHer(stage: Stage): void {
    const finder =
      this.#near(stage, this.#rosa, SEEN_M) ??
      (stage.chance.odds(GLIMPSE_ODDS) ? this.#near(stage, this.#rosa, GLIMPSED_M) : undefined);
    if (finder === undefined) return;
    this.#found = { elapsed: stage.elapsed, by: finder.alias };
    finder.go({ kind: 'scene', what: stage.t('practiceMissingWithHer') }, [this.#rosa], stage.now);
    const where = stage.ground.where(stage.t, this.#rosa, landmarkOf(stage));
    const seen = {
      park: 'practiceMissingFoundPark',
      water: 'practiceMissingFoundWater',
      street: 'practiceMissingFoundStreet',
    } as const;
    stage.say(finder.alias, stage.t(seen[this.#spot], { where }));
    this.#mark(stage, finder.alias);
    stage.after(40, () => {
      stage.act(finder.alias, {
        type: 'report',
        incident: 'missing-person',
        hazards: [],
        access: 'clear',
        casualties: { red: null, yellow: 1, green: null, black: null },
        resources: ['ambulance'],
        note: stage.t('practiceMissingFoundReport'),
      });
    });
    stage.after(30, () => {
      stage.say(dispatch(stage.t), stage.t('practiceMissingAmbulance'));
      this.#keepHerCompany(stage, finder);
    });
    stage.after(30 + AMBULANCE_S, () => {
      stage.say(dispatch(stage.t), stage.t('practiceMissingSafe'));
      for (const who of stage.crew.all) {
        if (who.job?.kind === 'scene') who.stop(stage.now);
      }
    });
    stage.after(50 + AMBULANCE_S, () => {
      stage.finish(stage.t('practiceMissingEnd', { minutes: minutes(this.#found?.elapsed ?? 0) }));
    });
  }

  #foundByDogs(stage: Stage): void {
    this.#found = { elapsed: stage.elapsed, by: dispatch(stage.t) };
    const where = stage.ground.where(stage.t, this.#rosa, landmarkOf(stage));
    this.#mark(stage, dispatch(stage.t));
    stage.say(dispatch(stage.t), stage.t('practiceMissingFoundByDogs', { where }));
    stage.after(60, () => {
      stage.finish(stage.t('practiceMissingEndDogs', { minutes: minutes(stage.elapsed) }));
    });
  }

  /** The nearest teammate joins whoever found her, to wait with her for the ambulance. */
  #keepHerCompany(stage: Stage, finder: Teammate): void {
    const helper = stage.crew.nearest(this.#rosa, (who) => who !== finder && !who.silent);
    if (helper === undefined) return;
    const job = { kind: 'scene', what: stage.t('practiceMissingWithHer') } as const;
    if (stage.walk(helper, job, { kind: 'along', points: [this.#rosa] }) !== null) {
      stage.say(helper.alias, stage.line('goingTo', { name: finder.alias }));
    }
  }

  #mark(stage: Stage, by: string): void {
    stage.act(by, {
      type: 'marker',
      id: 'rosa',
      symbol: SymbolCode.INJURED,
      label: 'Rosa',
      where: this.#rosa,
    });
  }

  /** Someone on foot, with a working phone, within `metres` of a place. */
  #near(stage: Stage, at: LatLon, metres: number): Teammate | undefined {
    return stage.crew.onTheGround.find(
      (teammate) => !teammate.silent && distanceMeters(teammate.at(stage.now), at) <= metres,
    );
  }
}

/**
 * Where she is: a point of the streets the right distance away, in the direction she went, the
 * likelier in a park, then by the water, then at the end of a street; straight that way where the
 * map has no streets.
 */
function whereSheIs(
  ground: Ground,
  from: LatLon,
  went: number,
  random: () => number,
): { readonly rosa: LatLon; readonly spot: Spot } {
  const [near, far] = WANDERED_M;
  const ends = new Set(
    (ground.network?.deadEnds ?? []).map((point) => `${String(point.lat)},${String(point.lon)}`),
  );
  const candidates = (ground.network?.points ?? []).flatMap((point) => {
    const away = distanceMeters(from, point);
    const turned = Math.abs(((bearingDegrees(from, point) - went + 540) % 360) - 180);
    if (away < near || away > far || turned > TURNED_DEG) return [];
    const spot: Spot = ground.greenAt(point)
      ? 'park'
      : ground.waterAt(point, BY_THE_WATER_M)
        ? 'water'
        : 'street';
    const score =
      (spot === 'park' ? 3 : spot === 'water' ? 2 : 0) +
      (ends.has(`${String(point.lat)},${String(point.lon)}`) ? 1 : 0) +
      random();
    return [{ point, spot, score }];
  });
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (best !== undefined) return { rosa: best.point, spot: best.spot };
  const rad = (went * Math.PI) / 180;
  const away = (near + far) / 2;
  return { rosa: offsetMeters(from, away * Math.cos(rad), away * Math.sin(rad)), spot: 'street' };
}

/** Whole minutes, as people tell them. */
function minutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}
