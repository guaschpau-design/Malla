// Someone loses the group in the fog (mountain-world.ts): Jordi takes a path that leads nowhere,
// or falls behind, and stops there, unable to see anyone. Someone sent to where his phone puts him
// finds him and brings him back; if nobody comes, he finds his own way back after a while. With the
// user as a member, Carmen tells him to stay put and sends Nuria; as coordinator, the user must.

import type { LatLon, Role } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';
import { CallOut } from './call-out.ts';
import { CARMEN, JORDI, NURIA } from './cast.ts';

/** How long he waits before he finds his own way back. */
const ALONE_S = 420;

/** How it went: how long he was lost, and how it ended; null if he never was. */
export interface AstrayTally {
  readonly lostFor: number;
  readonly ended: 'found' | 'alone' | 'still';
}

export class Astray {
  readonly #user: Role;
  #lost: { readonly at: LatLon; readonly since: number; readonly who: Teammate } | null = null;
  #search: CallOut | null = null;
  /** How long he was lost, and whether someone found him; null while he is, or never was. */
  #ended: { readonly after: number; readonly found: boolean } | null = null;

  constructor(user: Role) {
    this.#user = user;
  }

  /** How it went by `elapsed` seconds into the exercise; null if he has not been lost. */
  tally(elapsed: number): AstrayTally | null {
    const lost = this.#lost;
    if (lost === null) return null;
    if (this.#ended === null) return { lostFor: elapsed - lost.since, ended: 'still' };
    return { lostFor: this.#ended.after, ended: this.#ended.found ? 'found' : 'alone' };
  }

  /** Whether he is still lost. */
  get lost(): boolean {
    return this.#lost !== null && this.#ended === null;
  }

  /** Jordi wanders off to `to` in the fog, and stops there. */
  wander(stage: Stage, to: LatLon): void {
    const who = stage.crew.byAlias(JORDI);
    if (who === undefined || !who.onFoot || who.job !== null) return;
    const job = { kind: 'scene', what: stage.t('practiceMountainLostDoing') } as const;
    const arrival = stage.walk(who, job, { kind: 'along', points: [to] });
    if (arrival === null) return;
    stage.after((arrival - stage.now) / 1000, () => {
      if (who.job !== job) return;
      this.#lost = { at: who.at(stage.now), since: stage.elapsed, who };
      this.#search = new CallOut(this.#lost.at, { people: 2, seconds: 5 });
      const where = stage.ground.where(stage.t, this.#lost.at, landmarkOf(stage));
      stage.say(who.alias, stage.t('practiceMountainLost', { where }));
      if (this.#user === 'member') this.#sendNuria(stage);
    });
  }

  tick(stage: Stage): void {
    const lost = this.#lost;
    if (lost === null || this.#ended !== null || this.#search === null) return;
    const finders = this.#search.tick(stage);
    const finder = finders?.find((one) => one !== lost.who);
    if (finder !== undefined) {
      this.#back(stage, true);
      stage.say(finder.alias, stage.t('practiceMountainFound'));
      return;
    }
    if (stage.elapsed - lost.since < ALONE_S) return;
    this.#back(stage, false);
    stage.say(lost.who.alias, stage.t('practiceMountainBackAlone'));
  }

  /** He is back with the group, and so is whoever found him. */
  #back(stage: Stage, found: boolean): void {
    const lost = this.#lost;
    if (lost === null) return;
    this.#ended = { after: stage.elapsed - lost.since, found };
    lost.who.stop(stage.now);
  }

  /** When the user is a member, Carmen tells Jordi to stay put and sends Nuria to him. */
  #sendNuria(stage: Stage): void {
    stage.after(30, () => {
      const lost = this.#lost;
      if (lost === null || this.#ended !== null) return;
      stage.say(CARMEN, stage.t('practiceMountainStayPut'));
      stage.act(CARMEN, {
        type: 'task',
        id: 'find-jordi',
        text: stage.t('practiceMountainFindJordi'),
        assignee: NURIA,
        place: { kind: 'point', at: lost.at },
      });
    });
  }
}
