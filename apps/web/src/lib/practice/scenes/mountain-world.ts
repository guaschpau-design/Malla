// What happens on a mountain outing (mountain-route.ts). The group climbs in a column at its own
// pace (mountain-column.ts); the forecast warns of storms; ten minutes in, the fog comes down and
// Jordi loses the group (mountain-astray.ts); at fourteen, Sara slips and must be rescued
// (mountain-rescue.ts); at sixteen, thunder is heard, and at twenty-two the storm is overhead.
// The group must have turned back by then: whoever is still high on the mountain is in danger.
// With the user as a member, Carmen turns the group at the first thunder; as coordinator, the user
// must, by telling the group to go down or giving them a task back at the trailhead.

import { distanceMeters } from '@tesel/core';
import type { Role } from '@tesel/protocol';
import type { Passable } from '@tesel/scenario';

import { errandOf } from '../errands.ts';
import type { Setting, Stage, World } from '../exercise.ts';
import {
  CARMEN,
  dispatch,
  EXERCISE_SECONDS,
  JORDI,
  LUIS,
  MARTA,
  NURIA,
  PABLO,
  SARA,
} from './cast.ts';
import { Column } from './mountain-column.ts';
import { Astray, type AstrayTally } from './mountain-astray.ts';
import { Rescue, type RescueTally } from './mountain-rescue.ts';
import type { MountainRoute } from './mountain-route.ts';

/** When the forecast warns, the fog comes, someone slips, it thunders and the storm arrives. */
const FORECAST_S = 300;
const FOG_S = 600;
const HURT_S = 840;
export const THUNDER_S = 960;
const STORM_S = 1320;
/** Higher up the route than this share of it, the group is on the exposed upper slopes. */
const EXPOSED_ABOVE = 2 / 3;
/** How far back down the route Jordi stops when there is no stray path to take. */
const FALLS_BEHIND_M = 120;
/** A task this near the trailhead sends whoever gets it back down. */
const TRAILHEAD_NEAR_M = 100;
/** Words that tell the group to turn back, in either language. */
/** The order the group walks in: the guide first, the sweeper last. */
const ORDER = [CARMEN, NURIA, LUIS, JORDI, MARTA, SARA, PABLO];
const TURN_BACK =
  /\b(baj(?:a|ad|amos|ar|en|emos)|volv(?:ed|emos|er|amos)|vuelta|retir(?:ada|amos|aos|arse)|abajo|descend\w*|turn (?:back|round)|go (?:back|down)|head (?:back|down))\b/iu;

/** How the outing went, for the report. */
export interface MountainTally {
  /** When the group turned back, in seconds into the exercise, and who decided; null if it never did. */
  readonly turnedAt: number | null;
  readonly turnedBy: 'user' | 'carmen' | 'storm' | null;
  /** How many were still high on the mountain when the storm came; null before it has. */
  readonly exposed: number | null;
  readonly astray: AstrayTally | null;
  readonly rescue: RescueTally | null;
}

export class MountainWorld implements World {
  readonly route: MountainRoute;
  readonly #column: Column;
  readonly #astray: Astray;
  readonly #rescue: Rescue;
  readonly #user: Role;
  #turned: { readonly at: number; readonly by: 'user' | 'carmen' | 'storm' } | null = null;
  #exposed: number | null = null;

  constructor({ t, user }: Setting, route: MountainRoute) {
    this.route = route;
    this.#user = user;
    this.#column = new Column(route, ORDER);
    this.#astray = new Astray(user);
    this.#rescue = new Rescue(HURT_S, STORM_S, route.pointAt(0), dispatch(t), user);
  }

  tally(stage: Stage): MountainTally {
    return {
      turnedAt: this.#turned?.at ?? null,
      turnedBy: this.#turned?.by ?? null,
      exposed: this.#exposed,
      astray: this.#astray.tally(stage.elapsed),
      rescue: this.#rescue.tally(stage),
    };
  }

  /** Nothing on the mountain stands in anyone's way: the paths are the way. */
  passable(): Passable {
    return () => true;
  }

  tick(stage: Stage): void {
    // The group waits with someone hurt, until it turns back.
    this.#column.halt(this.#rescue.waiting && this.#turned === null);
    this.#column.tick(stage);
    this.#weather(stage);
    this.#astray.tick(stage);
    this.#rescue.tick(stage);
    this.#turnBack(stage);
    this.#summit(stage);
    this.#storm(stage);
    if (stage.elapsed >= EXERCISE_SECONDS) {
      const saying =
        (this.#exposed ?? 0) > 0 ? 'practiceMountainEndExposed' : 'practiceMountainEnd';
      stage.finish(stage.t(saying));
    }
  }

  /** The forecast, the fog that takes Jordi astray, and the first thunder. */
  #weather(stage: Stage): void {
    if (stage.elapsed >= FORECAST_S && stage.once('forecast')) {
      stage.say(NURIA, stage.t('practiceMountainForecast'));
    }
    if (stage.elapsed >= FOG_S && stage.once('fog')) {
      stage.say(CARMEN, stage.t('practiceMountainFog'));
      const jordi = stage.crew.byAlias(JORDI);
      if (jordi !== undefined) {
        const from = jordi.at(stage.now);
        const behind = this.route.pointAt(this.#column.along - FALLS_BEHIND_M);
        this.#astray.wander(stage, this.route.astray(stage.ground, from) ?? behind);
      }
    }
    if (stage.elapsed >= THUNDER_S && stage.once('thunder')) {
      stage.say(NURIA, stage.t('practiceMountainThunder'));
      if (this.#user === 'member') {
        stage.after(20, () => {
          this.#turn(stage, 'carmen');
          stage.say(CARMEN, stage.t('practiceMountainTurnBack'));
        });
      }
    }
  }

  /** When the user leads, the group turns back once they say so, or send it down to the trailhead. */
  #turnBack(stage: Stage): void {
    if (this.#turned !== null || this.#user !== 'coordinator') return;
    const said = stage.state.chat.some(
      (message) => message.origin === stage.user.node && TURN_BACK.test(message.text),
    );
    const trailhead = this.route.pointAt(0);
    const sent = [...stage.state.tasks.values()].some((task) => {
      if (task.task.origin !== stage.user.node) return false;
      const [point] = errandOf(task, stage.state.objects, null).points;
      return point !== undefined && distanceMeters(point, trailhead) <= TRAILHEAD_NEAR_M;
    });
    if (!said && !sent) return;
    this.#turn(stage, 'user');
    stage.after(5, () => {
      stage.say(CARMEN, stage.t('practiceMountainTurning'));
    });
  }

  #turn(stage: Stage, by: 'user' | 'carmen' | 'storm'): void {
    if (this.#turned !== null) return;
    this.#turned = { at: stage.elapsed, by };
    this.#column.turn();
  }

  /** Whoever gets to the top says so, once. */
  #summit(stage: Stage): void {
    if (!this.#column.atTop || !stage.once('summit')) return;
    const [head] = this.#column.walkers(stage);
    const height = Math.round(this.route.high);
    stage.say(head?.alias ?? CARMEN, stage.t('practiceMountainSummit', { height }));
  }

  /** The storm comes: whoever is still high up is in danger, and the group goes down regardless. */
  #storm(stage: Stage): void {
    if (stage.elapsed < STORM_S || !stage.once('storm')) return;
    const high = this.#column.along >= this.route.length * EXPOSED_ABOVE;
    this.#exposed = high ? this.#column.walkers(stage).length : 0;
    stage.say(NURIA, stage.t(high ? 'practiceMountainLightning' : 'practiceMountainStormBelow'));
    if (this.#turned === null) {
      this.#turn(stage, 'storm');
      stage.say(CARMEN, stage.t('practiceMountainStormTurn'));
    }
  }
}
