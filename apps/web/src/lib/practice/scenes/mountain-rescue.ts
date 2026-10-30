// Someone hurt on the way (mountain-world.ts): Sara slips on a scree and can no longer walk; Marta,
// the nurse, stays with her, and the group waits. Someone must call the 112 with a report. The
// rescue helicopter comes five minutes later, two more if nobody has marked where it can land near
// her, and cannot fly once the storm is overhead: then the mountain rescue team comes on foot, an
// hour later. With the user as a member, Carmen asks them to send the report and mark the landing
// place, and sends it herself if they have not; as coordinator, it is the user's to do.

import { distanceMeters } from '@tesel/core';
import { SymbolCode, type LatLon, type Role } from '@tesel/protocol';
import { YOU } from '@tesel/scenario';

import type { Stage } from '../exercise.ts';
import type { Teammate } from '../teammate.ts';
import { CARMEN, MARTA, SARA } from './cast.ts';

/** The marker of where she lies, for tasks to refer to. */
const HURT = 'hurt-hiker';
/** How long the helicopter takes, and how much longer when it must find a place to land. */
const FLIES_S = 300;
const SEEKS_S = 120;
/** A landing place marked this near her will do. */
const LANDING_NEAR_M = 400;
/** How long Carmen waits for the user's report before she sends it herself. */
const CARMEN_CALLS_S = 180;
/** How fast the helicopter takes her away, in metres per second. */
const FLIGHT_MPS = 40;

/** How the rescue went, in seconds into the exercise; null for what has not happened. */
export interface RescueTally {
  readonly calledAt: number | null;
  /** Whether the user sent the report, not Carmen. */
  readonly byUser: boolean;
  readonly landingMarked: boolean;
  readonly ended: 'helicopter' | 'on-foot' | 'waiting';
  readonly hurtAt: number;
}

export class Rescue {
  /** When she slips, and when the storm comes, in seconds into the exercise. */
  readonly #hurtS: number;
  readonly #stormS: number;
  readonly #user: Role;
  readonly #room: string;
  /** Where the helicopter takes her: the trailhead. */
  readonly #away: LatLon;
  #hurt: { readonly who: Teammate; readonly at: LatLon } | null = null;
  #calledAt: number | null = null;
  #byUser = false;
  #due: number | null = null;
  #sought = false;
  #ended: 'helicopter' | 'on-foot' | null = null;

  constructor(hurtS: number, stormS: number, away: LatLon, room: string, user: Role) {
    this.#hurtS = hurtS;
    this.#stormS = stormS;
    this.#away = away;
    this.#room = room;
    this.#user = user;
  }

  /** Whether someone hurt is waiting for the rescue, with the group. */
  get waiting(): boolean {
    return this.#hurt !== null && this.#ended === null;
  }

  /** How the rescue went, as the group now is; null if nobody has been hurt. */
  tally(stage: Stage): RescueTally | null {
    if (this.#hurt === null) return null;
    return {
      calledAt: this.#calledAt,
      byUser: this.#byUser,
      landingMarked: this.#landing(stage) !== null,
      ended: this.#ended ?? 'waiting',
      hurtAt: this.#hurtS,
    };
  }

  tick(stage: Stage): void {
    if (stage.elapsed < this.#hurtS || this.#ended !== null) return;
    const hurt = this.#hurt;
    if (hurt === null) {
      this.#fall(stage);
      return;
    }
    if (this.#calledAt === null) this.#call(stage);
    if (stage.elapsed >= this.#stormS) {
      if (this.#calledAt !== null) {
        this.#ended = 'on-foot';
        stage.say(this.#room, stage.t('practiceMountainNoFlying'));
      }
      return;
    }
    if (this.#due === null || stage.elapsed < this.#due) return;
    if (this.#landing(stage) === null && !this.#sought) {
      this.#sought = true;
      this.#due += SEEKS_S;
      stage.say(this.#room, stage.t('practiceMountainSeeking'));
      return;
    }
    this.#ended = 'helicopter';
    stage.say(this.#room, stage.t('practiceMountainLifted', { name: hurt.who.alias }));
    const lifted = { kind: 'scene', what: stage.t('practiceMountainLiftedDoing') } as const;
    hurt.who.go(lifted, [this.#away], stage.now, FLIGHT_MPS);
    stage.crew.byAlias(MARTA)?.stop(stage.now);
  }

  /** Where someone marked that the helicopter can land near her; null if nobody has. */
  #landing(stage: Stage): LatLon | null {
    const hurt = this.#hurt;
    if (hurt === null) return null;
    for (const record of stage.state.objects.values()) {
      if (record.type !== 'marker' || record.symbol !== SymbolCode.HELICOPTER) continue;
      const at = { lat: record.lat, lon: record.lon };
      if (distanceMeters(at, hurt.at) <= LANDING_NEAR_M) return at;
    }
    return null;
  }

  /** She slips and stays where she is; Marta goes to her and tells the group. */
  #fall(stage: Stage): void {
    const fit = (one: Teammate) =>
      one.onFoot && one.job === null && one.alias !== MARTA && !one.coordinates;
    const sara = stage.crew.byAlias(SARA);
    const who = sara !== undefined && fit(sara) ? sara : stage.crew.onTheGround.find(fit);
    if (who === undefined) return;
    const at = who.at(stage.now);
    this.#hurt = { who, at };
    who.go({ kind: 'scene', what: stage.t('practiceMountainHurtDoing') }, [at], stage.now);
    const nurse = stage.crew.byAlias(MARTA);
    const staying = {
      kind: 'scene',
      what: stage.t('practiceMountainWithHurt', { name: who.alias }),
    } as const;
    if (nurse?.onFoot === true) stage.walk(nurse, staying, { kind: 'along', points: [at] });
    const by = nurse?.onFoot === true ? MARTA : who.alias;
    stage.act(by, {
      type: 'marker',
      id: HURT,
      symbol: SymbolCode.INJURED,
      label: stage.t('practiceMountainHurtLabel', { name: who.alias }),
      where: at,
    });
    stage.say(by, stage.t('practiceMountainHurt', { name: who.alias }));
    if (this.#user === 'member') this.#askUser(stage);
  }

  /** The report that calls the 112: the user's, or, past a while, Carmen's when the user is a member. */
  #call(stage: Stage): void {
    const fell = Math.floor(stage.now / 1000) - Math.round(stage.elapsed - this.#hurtS);
    const reported = stage.state.reports.some(
      (report) => report.origin === stage.user.node && report.time >= fell,
    );
    const carmenCalls = this.#user === 'member' && stage.elapsed - this.#hurtS >= CARMEN_CALLS_S;
    if (!reported && !carmenCalls) return;
    this.#calledAt = stage.elapsed;
    this.#byUser = reported;
    if (!reported) {
      stage.act(CARMEN, {
        type: 'report',
        incident: 'rescue',
        hazards: [],
        access: 'difficult',
        casualties: { red: null, yellow: 1, green: null, black: null },
        resources: ['rescue', 'helicopter'],
        note: stage.t('practiceMountainCarmenReport'),
      });
      stage.say(CARMEN, stage.t('practiceMountainCarmenCalls'));
    }
    if (stage.elapsed >= this.#stormS) return;
    this.#due = stage.elapsed + FLIES_S;
    stage.after(20, () => {
      stage.say(this.#room, stage.t('practiceMountainHelicopter'));
    });
  }

  /** When the user is a member, Carmen asks them to call it in and mark where it can land. */
  #askUser(stage: Stage): void {
    stage.after(20, () => {
      stage.act(CARMEN, {
        type: 'task',
        id: 'report-hurt',
        text: stage.t('practiceMountainSendReport'),
        assignee: YOU,
        place: { kind: 'object', id: HURT },
      });
      stage.act(CARMEN, {
        type: 'task',
        id: 'landing',
        text: stage.t('practiceMountainMarkLanding'),
        assignee: YOU,
        place: null,
      });
      stage.say(CARMEN, stage.t('practiceMountainAskUser', { name: stage.user.name }));
    });
  }
}
