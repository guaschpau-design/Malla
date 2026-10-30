// The homes in a flood's way (flood-world.ts): six, three of which the control room knows of. The
// team warns those it passes. One the water reaches before anyone has warned it is a family trapped,
// which someone with a rope must get out, or the fire brigade's boat does, late.

import { distanceMeters } from '@tesel/core';
import { SymbolCode, type LatLon, type Role } from '@tesel/protocol';

import type { Chance } from '../chance.ts';
import type { Stage } from '../exercise.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';
import { CallOut } from './call-out.ts';
import { CARMEN, dispatch, JORDI, NORTH, NURIA } from './cast.ts';
import type { FloodWater } from './flood-water.ts';

/** Water this deep at a home traps whoever is in it. */
const TRAPS_M = 0.3;
/** Homes the water reaches between these levels: some minutes in, not at once nor never. */
const HOMES_REACHED = [0.8, 1.4] as const;
const HOMES = 6;
const HOMES_KNOWN = 3;
const HOMES_APART_M = 70;
/** Someone this close to a home warns it. */
const WARNS_M = 35;
/** How long a trapped family, or a teammate the water has caught, waits for the fire brigade's boat. */
export const BOAT_AFTER_S = 480;

interface Home {
  readonly at: LatLon;
  readonly id: string;
  /** Its number in the street, as people call it. */
  readonly number: number;
  /** The control room told of it: it is on the map. */
  readonly known: boolean;
  warned: boolean;
  trapped: CallOut | null;
  /** When the water trapped it, in seconds into the exercise. */
  trappedAt: number;
  /** How it ended: got out by the team, or by the fire brigade. */
  ended: 'rescued' | 'boat' | null;
}

/** How a home is marked on the map, by what happened to it. */
type HomeLabel =
  | 'practiceFloodHomeKnown'
  | 'practiceFloodHomeWarned'
  | 'practiceFloodHomeTrapped'
  | 'practiceFloodHomeRescued';

export class FloodHomes {
  readonly #homes: Home[];
  readonly #user: Role;

  /** Homes among `spots` that `water` reaches some minutes in, some way apart, nearest first. */
  constructor(
    spots: readonly LatLon[],
    water: FloodWater,
    centre: LatLon,
    chance: Chance,
    user: Role,
  ) {
    this.#user = user;
    const [low, high] = HOMES_REACHED;
    const reached = spots
      .filter((point) => water.reachAt(point) > low && water.reachAt(point) < high)
      .sort((a, b) => distanceMeters(a, centre) - distanceMeters(b, centre));
    const places: LatLon[] = [];
    for (const point of reached) {
      if (places.length === HOMES) break;
      if (places.every((home) => distanceMeters(home, point) >= HOMES_APART_M)) places.push(point);
    }
    this.#homes = places.map((at, index) => ({
      at,
      id: `home-${String(index)}`,
      number: Math.round(chance.between(1, 60)),
      known: index < HOMES_KNOWN,
      warned: false,
      trapped: null,
      trappedAt: 0,
      ended: null,
    }));
  }

  /** Where the homes stand. */
  get places(): ReadonlySet<LatLon> {
    return new Set(this.#homes.map((home) => home.at));
  }

  /** Whether every home was warned or its people got out. */
  get safe(): boolean {
    return this.#homes.every((home) => home.warned || home.ended !== null);
  }

  /** How many homes were warned in time, of how many. */
  get warned(): { warned: number; homes: number } {
    return { warned: this.#homes.filter((home) => home.warned).length, homes: this.#homes.length };
  }

  /** Each home is warned, trapped or got out of, as the water, `deep` metres at a point, rises. */
  tick(stage: Stage, deep: (at: LatLon) => number): void {
    for (const home of this.#homes) this.#home(stage, home, deep(home.at));
  }

  /** The control room tells of the homes it knows of, and marks them. */
  tellOf(stage: Stage): void {
    const known = this.#homes.filter((home) => home.known);
    for (const home of known) mark(stage, dispatch(stage.t), home, 'practiceFloodHomeKnown');
    const streets = known.map((home) => stage.ground.address(stage.t, home.at, landmarkOf(stage)));
    stage.say(dispatch(stage.t), stage.t('practiceFloodHomes', { streets: stage.list(streets) }));
  }

  /** When the user is a member, Carmen sends someone of the north team to each home known of. */
  warnKnown(stage: Stage): void {
    const assignees = [JORDI, NURIA, NORTH];
    this.#homes
      .filter((home) => home.known)
      .forEach((home, index) => {
        stage.act(CARMEN, {
          type: 'task',
          id: `warn-${home.id}`,
          text: stage.t('practiceFloodWarnHome', said(stage, home)),
          assignee: assignees[index] ?? NORTH,
          place: { kind: 'object', id: home.id },
        });
      });
  }

  #home(stage: Stage, home: Home, depth: number): void {
    if (home.ended !== null) return;
    if (!home.warned && home.trapped === null) {
      const warner = stage.crew.onTheGround.find(
        (who) => !who.silent && who.distanceTo(home.at, stage.now) <= WARNS_M,
      );
      if (warner !== undefined) {
        home.warned = true;
        const saying = home.known ? 'practiceFloodWarnedKnown' : 'practiceFloodWarnedFound';
        stage.say(warner.alias, stage.t(saying, said(stage, home)));
        if (home.known) mark(stage, warner.alias, home, 'practiceFloodHomeWarned');
        return;
      }
      if (depth < TRAPS_M) return;
      home.trapped = new CallOut(home.at, { people: 1, kit: 'rope', seconds: 60 });
      home.trappedAt = stage.elapsed;
      mark(stage, dispatch(stage.t), home, 'practiceFloodHomeTrapped');
      stage.say(dispatch(stage.t), stage.t('practiceFloodTrapped', said(stage, home)));
      if (this.#user === 'member') sendRescue(stage, home);
      return;
    }
    if (home.trapped === null) return;
    const [rescuer] = home.trapped.tick(stage) ?? [];
    if (rescuer !== undefined) {
      home.ended = 'rescued';
      stage.say(rescuer.alias, stage.t('practiceFloodRescued', said(stage, home)));
      mark(stage, rescuer.alias, home, 'practiceFloodHomeRescued');
      return;
    }
    const [alone] = home.trapped.with(stage);
    if (alone !== undefined && !alone.has('rope') && stage.once(`rope ${home.id}`)) {
      stage.say(alone.alias, stage.t('practiceFloodNeedRope', said(stage, home)));
    }
    if (stage.elapsed - home.trappedAt < BOAT_AFTER_S) return;
    home.ended = 'boat';
    stage.say(dispatch(stage.t), stage.t('practiceFloodBoat', said(stage, home)));
    if (this.#user === 'member') {
      stage.act(CARMEN, { type: 'task-status', of: `rescue-${home.id}`, status: 'cancelled' });
      stage.say(CARMEN, stage.t('practiceFloodCancelRescue'));
    }
  }
}

/** A home as it is told: its number and where it is. */
function said(stage: Stage, home: Home): { number: number; where: string } {
  return {
    number: home.number,
    where: stage.ground.address(stage.t, home.at, landmarkOf(stage)),
  };
}

/** Marks a home on the map, by what happened to it. */
function mark(stage: Stage, by: string, home: Home, label: HomeLabel): void {
  stage.act(by, {
    type: 'marker',
    id: home.id,
    symbol: label === 'practiceFloodHomeTrapped' ? SymbolCode.HAZARD : SymbolCode.SHELTER,
    label: stage.t(label, { number: home.number }),
    where: home.at,
  });
}

/** Carmen sends whoever has a rope to a trapped home, nearest and free if she can. */
function sendRescue(stage: Stage, home: Home): void {
  stage.after(20, () => {
    const can = (who: Teammate) => who.has('rope') && !who.coordinates && !who.silent;
    const roped =
      stage.crew.nearest(home.at, (who) => who.free && can(who)) ??
      stage.crew.nearest(home.at, can);
    stage.act(CARMEN, {
      type: 'task',
      id: `rescue-${home.id}`,
      text: stage.t('practiceFloodRescue', said(stage, home)),
      assignee: roped?.alias ?? null,
      place: { kind: 'object', id: home.id },
    });
    stage.say(CARMEN, stage.t('practiceFloodSendRescue', { name: roped?.alias ?? '' }));
  });
}
