// What happens in a popular race (race-course.ts) while the team keeps it safe. Cars try to cross
// the course now and then at each crossing: one with someone guarding it is stopped, one without
// gets in among the runners, until the local police take over a crossing left twice. The race's control moves the leaders' and the sweeper bike's markers
// as they go, and tells when the winner is in. A runner collapses (race-collapse.ts), a van stops
// on the course and the aid station runs out of water (race-mishaps.ts). The race goes on past the
// exercise.

import { distanceMeters } from '@tesel/core';
import { SymbolCode, type LatLon } from '@tesel/protocol';
import type { Passable } from '@tesel/scenario';

import type { Translate } from '../../i18n/index.ts';
import { errandOf } from '../errands.ts';
import type { Setting, Stage, World } from '../exercise.ts';
import type { Teammate } from '../teammate.ts';
import { EXERCISE_SECONDS, type Place } from './cast.ts';
import { Collapse, type CollapseTally } from './race-collapse.ts';
import { RaceCourse, START_S, type Crossing } from './race-course.ts';
import { Mishaps, type MishapsTally } from './race-mishaps.ts';

/** Someone this close to a crossing guards it. */
const GUARDS_M = 30;
/** Seconds between two cars trying to cross at the same crossing, at least and at most. */
const CARS_EVERY_S = [300, 600] as const;
/** After this many cars at the same crossing, the local police take it over. */
const POLICE_AFTER_CARS = 2;
/** Seconds between the moves of the leaders' and the sweeper's markers. */
const MARKERS_EVERY_S = 60;
/** How far round the loop the runner collapses, the van stops and the aid station stands. */
const COLLAPSE_ALONG = 0.55;
const VAN_ALONG = 0.3;
const AID_ALONG = 0.5;
/** The middle of the field's pace, in metres per second, which the collapse comes with. */
const MIDDLE_MPS = 3.4;
/** How long the user has to tell of the leaders passing their crossing. */
const REPORT_WITHIN_S = 120;

/** How the race went, for the report. */
export interface RaceTally extends CollapseTally, MishapsTally {
  /** Crossings guarded when the leaders first passed, of how many. */
  readonly guarded: number;
  readonly crossings: number;
  /** Cars that got in among the runners. */
  readonly cars: number;
  /** Whether the user told the team when the leaders passed their crossing; null if not asked. */
  readonly userReported: boolean | null;
}

interface Post {
  readonly crossing: Crossing;
  /** When a car next tries to cross, in seconds into the exercise. */
  nextCar: number;
  /** Whether it was guarded when the leaders first passed; null until they have. */
  guardedAtHead: boolean | null;
  /** Cars that got in there; past a couple, the police guard it. */
  cars: number;
}

export class RaceWorld implements World {
  readonly course: RaceCourse;
  readonly aidStation: LatLon;
  readonly #posts: Post[];
  readonly #collapse: Collapse;
  readonly #mishaps: Mishaps;
  /** Who speaks for the race: its control, which is told of everything. */
  readonly #control: string;
  #cars = 0;
  /** The crossing the user was sent to, and whether they told of the leaders passing it. */
  #userPost: string | null = null;
  #userReported: boolean | null = null;

  constructor({ t, ground, centre, user, chance }: Setting, at: Place) {
    const course = new RaceCourse(ground, centre, at(-60, -80));
    this.course = course;
    this.aidStation = course.pointAt(course.lap * AID_ALONG);
    this.#control = raceControl(t);
    this.#posts = course.crossings.map((crossing) => ({
      crossing,
      nextCar: START_S + chance.between(...CARS_EVERY_S),
      guardedAtHead: null,
      cars: 0,
    }));
    const along = course.lap * COLLAPSE_ALONG;
    const collapseS = Math.round(START_S + along / MIDDLE_MPS);
    this.#collapse = new Collapse(course.pointAt(along), collapseS, this.#control, user);
    const van = course.pointAt(course.lap * VAN_ALONG);
    this.#mishaps = new Mishaps(van, this.aidStation, this.#control, user);
  }

  /** The crossing as it is said: "Calle Mayor con Calle Nueva", or by its number. */
  crossingName(t: Translate, crossing: Crossing): string {
    const { streets, number } = crossing;
    return streets === null
      ? t('practiceRaceCrossingNumber', { number })
      : t('practiceRaceCrossing', { a: streets[0], b: streets[1] });
  }

  /** The user is to guard a crossing, by its id, and tell when the leaders pass it. */
  postUser(crossing: string): void {
    this.#userPost = crossing;
    this.#userReported = false;
  }

  get tally(): RaceTally {
    return {
      guarded: this.#posts.filter((post) => post.guardedAtHead === true).length,
      crossings: this.#posts.length,
      cars: this.#cars,
      userReported: this.#userReported,
      ...this.#collapse.tally,
      ...this.#mishaps.tally,
    };
  }

  /** Nothing in a race stands in the team's way. */
  passable(): Passable {
    return () => true;
  }

  tick(stage: Stage): void {
    for (const post of this.#posts) this.#post(stage, post);
    this.#markers(stage);
    this.#collapse.tick(stage);
    this.#mishaps.tick(stage);
    this.#end(stage);
  }

  /** The leaders pass a crossing, and cars try to cross it now and then. */
  #post(stage: Stage, post: Post): void {
    const { crossing } = post;
    if (post.guardedAtHead === null && stage.elapsed >= this.course.headPasses(crossing.along)) {
      const guard = this.#guard(stage, crossing);
      post.guardedAtHead = guard !== null;
      if (guard !== null && guard !== 'user') {
        stage.say(guard.alias, stage.line('raceHeadPasses', { number: crossing.number }));
      }
      if (this.#userPost === crossing.id) this.#watchUserReport(stage);
    }
    if (stage.elapsed < post.nextCar) return;
    post.nextCar = stage.elapsed + stage.chance.between(...CARS_EVERY_S);
    if (!this.course.passing(crossing.along, stage.elapsed)) return;
    if (post.cars >= POLICE_AFTER_CARS) return;
    const guard = this.#guard(stage, crossing);
    if (guard === null) {
      this.#cars += 1;
      post.cars += 1;
      const name = this.crossingName(stage.t, crossing);
      stage.say(this.#control, stage.t('practiceRaceCarIn', { crossing: name }));
      if (post.cars === POLICE_AFTER_CARS) {
        stage.say(this.#control, stage.t('practiceRacePolice', { number: crossing.number }));
      }
      return;
    }
    if (guard !== 'user' && stage.once(`car stopped ${crossing.id}`)) {
      stage.say(guard.alias, stage.t('practiceRaceCarStopped', { number: crossing.number }));
    }
  }

  /** Who guards a crossing now: a teammate at it, who stays; or the user, on a task there. */
  #guard(stage: Stage, crossing: Crossing): Teammate | 'user' | null {
    const there = stage.crew.onTheGround.find(
      (who) => !who.silent && who.distanceTo(crossing.at, stage.now) <= GUARDS_M,
    );
    if (there !== undefined) {
      if (there.free && there.post === null) there.guard(crossing.id);
      return there;
    }
    const userOnIt = [...stage.state.tasks.values()].some((task) => {
      if (task.assignee !== stage.user.node) return false;
      if (task.status !== 'in-progress' && task.status !== 'done') return false;
      const { points } = errandOf(task, stage.state.objects, null);
      const [point] = points;
      return (
        points.length === 1 && point !== undefined && distanceMeters(point, crossing.at) <= GUARDS_M
      );
    });
    return userOnIt ? 'user' : null;
  }

  /** Whether the user says something in the chat soon after the leaders pass their crossing. */
  #watchUserReport(stage: Stage): void {
    const from = Math.floor(stage.now / 1000);
    stage.after(REPORT_WITHIN_S, () => {
      this.#userReported = stage.state.chat.some(
        (message) => message.origin === stage.user.node && message.time >= from,
      );
    });
  }

  /** The race's control moves the leaders' and the sweeper's markers as they go. */
  #markers(stage: Stage): void {
    const { course } = this;
    if (stage.elapsed < START_S || stage.elapsed > course.winnerIn + MARKERS_EVERY_S) return;
    if (!stage.once(`markers ${String(Math.floor(stage.elapsed / MARKERS_EVERY_S))}`)) return;
    const marker = (id: string, label: 'practiceRaceHead' | 'practiceRaceSweeper', at: number) => {
      stage.act(this.#control, {
        type: 'marker',
        id,
        symbol: SymbolCode.GENERIC,
        label: stage.t(label),
        where: course.pointAt(at),
      });
    };
    marker('race-head', 'practiceRaceHead', course.head(stage.elapsed));
    marker('race-sweeper', 'practiceRaceSweeper', course.tail(stage.elapsed));
  }

  /** The control tells when the winner is in; at the end, how many crossings were kept. */
  #end(stage: Stage): void {
    const { course } = this;
    if (stage.elapsed >= course.winnerIn && stage.once('winner')) {
      const time = raceTime(course.winnerIn - START_S);
      stage.say(this.#control, stage.t('practiceRaceWinner', { time }));
    }
    if (stage.elapsed < EXERCISE_SECONDS) return;
    const { guarded, crossings } = this.tally;
    stage.finish(stage.t('practiceRaceEnd', { guarded, crossings }));
  }
}

/** Who speaks for the race, in the user's language: its control, at the control room. */
export function raceControl(t: Translate): string {
  return t('practiceRaceControl');
}

/** A race time in minutes and seconds: "15:52". */
function raceTime(seconds: number): string {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}
