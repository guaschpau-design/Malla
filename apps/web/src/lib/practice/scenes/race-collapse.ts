// A runner collapses in the middle of a race (race-world.ts): their heart has stopped. Whoever of
// the team is near enough runs over and starts CPR, as anyone trained would, with the defibrillator
// if they carry one; otherwise one must be brought, sent by Carmen or by the user. The ambulance
// comes nine minutes later. CPR within three minutes and a shock within six bring the runner back before it comes.

import { SymbolCode, type LatLon, type Role } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';
import { landmarkOf } from '../landmark.ts';
import { CallOut } from './call-out.ts';
import { CARMEN } from './cast.ts';

/** The marker of where the runner lies, for a task to refer to. */
const COLLAPSE = 'collapse';
/** Teammates this near run over by themselves, at a run. */
const RUNS_OVER_M = 220;
const RUNNING_MPS = 3;
/** How long the ambulance takes. */
const AMBULANCE_S = 540;
/** CPR within this many seconds and a shock within this many bring the runner back. */
const CPR_IN_S = 180;
const SHOCK_IN_S = 360;

/** How it went, in seconds from the collapse; null for what never came. */
export interface CollapseTally {
  readonly happened: boolean;
  readonly cpr: number | null;
  readonly shock: number | null;
  readonly revived: boolean;
}

export class Collapse {
  readonly #at: LatLon;
  /** When it happens, in seconds into the exercise. */
  readonly #s: number;
  readonly #control: string;
  readonly #user: Role;
  #cpr: CallOut | null = null;
  #shock: CallOut | null = null;
  #cprIn: number | null = null;
  #shockIn: number | null = null;
  #revived = false;

  constructor(at: LatLon, s: number, control: string, user: Role) {
    this.#at = at;
    this.#s = s;
    this.#control = control;
    this.#user = user;
  }

  get tally(): CollapseTally {
    return {
      happened: this.#cpr !== null,
      cpr: this.#cprIn,
      shock: this.#shockIn,
      revived: this.#revived,
    };
  }

  tick(stage: Stage): void {
    if (stage.elapsed < this.#s) return;
    if (this.#cpr === null || this.#shock === null) {
      this.#cpr = new CallOut(this.#at, { people: 1, seconds: 0 });
      this.#shock = new CallOut(this.#at, { people: 1, kit: 'defibrillator', seconds: 20 });
      this.#raise(stage);
      return;
    }
    const since = stage.elapsed - this.#s;
    if (this.#cprIn === null && this.#cpr.tick(stage) !== null) {
      this.#cprIn = since;
      const [first] = this.#cpr.with(stage);
      if (first !== undefined) stage.say(first.alias, stage.t('practiceRaceCprStarted'));
    }
    const [shocker] = this.#shockIn === null ? (this.#shock.tick(stage) ?? []) : [];
    if (shocker !== undefined && since < AMBULANCE_S) {
      this.#shockIn = since;
      this.#revived = this.#cprIn !== null && this.#cprIn <= CPR_IN_S && since <= SHOCK_IN_S;
      stage.say(
        shocker.alias,
        stage.t(this.#revived ? 'practiceRaceRevived' : 'practiceRaceShockNoPulse'),
      );
    }
    if (since >= AMBULANCE_S && stage.once('ambulance')) this.#ambulance(stage);
  }

  /** The control tells of it and marks it; the nearest runs over; the defibrillator is sent. */
  #raise(stage: Stage): void {
    const where = stage.ground.where(stage.t, this.#at, landmarkOf(stage));
    stage.act(this.#control, {
      type: 'marker',
      id: COLLAPSE,
      symbol: SymbolCode.INJURED,
      label: stage.t('practiceRaceCollapseLabel'),
      where: this.#at,
    });
    stage.say(this.#control, stage.t('practiceRaceCollapse', { where }));
    const near = stage.crew.nearest(this.#at, (who) => !who.silent);
    const runs =
      near !== undefined &&
      near.distanceTo(this.#at, stage.now) <= RUNS_OVER_M &&
      stage.walk(
        near,
        { kind: 'scene', what: stage.t('practiceRaceDoingCpr') },
        { kind: 'along', points: [this.#at] },
        RUNNING_MPS,
      ) !== null;
    if (runs) {
      const carries = near.has('defibrillator');
      stage.say(
        near.alias,
        stage.t(carries ? 'practiceRaceRunningOverShock' : 'practiceRaceRunningOver'),
      );
      if (carries) return;
    }
    if (this.#user === 'member') this.#sendShock(stage, where);
    else this.#offerShock(stage);
  }

  /** When the user is a member, Carmen sends the defibrillator at once. */
  #sendShock(stage: Stage, where: string): void {
    stage.after(15, () => {
      const carrier = stage.crew.nearest(
        this.#at,
        (who) => who.has('defibrillator') && !who.silent,
      );
      if (carrier === undefined) return;
      stage.act(CARMEN, {
        type: 'task',
        id: 'defibrillator',
        text: stage.t('practiceRaceTakeDefibrillator', { where }),
        assignee: carrier.alias,
        place: { kind: 'object', id: COLLAPSE },
      });
      stage.say(CARMEN, stage.t('practiceRaceSendDefibrillator', { name: carrier.alias }));
    });
  }

  /** When the user coordinates, the nearest with a defibrillator offers to take it, unless sent. */
  #offerShock(stage: Stage): void {
    stage.after(45, () => {
      const carrier = stage.crew.nearest(
        this.#at,
        (who) => who.has('defibrillator') && !who.silent,
      );
      if (this.#shockIn === null && carrier?.job === null) {
        stage.say(carrier.alias, stage.t('practiceRaceOfferDefibrillator'));
      }
    });
  }

  /** The ambulance takes over: the runner goes to hospital, well or critical. */
  #ambulance(stage: Stage): void {
    const saying = this.#revived ? 'practiceRaceAmbulanceRevived' : 'practiceRaceAmbulanceCritical';
    stage.say(this.#control, stage.t(saying));
    const doingCpr = stage.t('practiceRaceDoingCpr');
    for (const who of stage.crew.all) {
      if (who.job?.kind === 'scene' && who.job.what === doingCpr) who.stop(stage.now);
    }
  }
}
