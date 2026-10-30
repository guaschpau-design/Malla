// What else goes wrong in a race (race-world.ts): a delivery van stops on the course among the
// runners, and someone must get it moved before one of them runs into it; later, the aid station
// runs out of water, and whoever has some in their car must bring it before the runners go dry.
// With the user as a member, Carmen sends someone to each; as coordinator, the user must.

import { SymbolCode, type LatLon, type Role } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';
import { CallOut } from './call-out.ts';
import { CARMEN } from './cast.ts';

/** The ids of the van's marker and of the aid station's, for tasks to refer to. */
const VAN = 'van';
export const AID_STATION = 'aid-station';
/** When the van stops, and the aid station runs out of water, in seconds into the exercise. */
const VAN_S = 840;
const WATER_S = 900;
/** How long the van, and the aid station, wait for someone before it goes wrong. */
const VAN_WAITS_S = 240;
const WATER_WAITS_S = 540;

/** A task Carmen gives: its id and words, and the marker of where it is. */
interface MishapTask {
  readonly id: string;
  readonly text: string;
  readonly marker: string;
  readonly at: LatLon;
}

/** How each ended: put right in time or not; null while it has not happened or is going on. */
export interface MishapsTally {
  readonly vanMoved: boolean | null;
  readonly watered: boolean | null;
}

export class Mishaps {
  readonly #van: CallOut;
  readonly #water: CallOut;
  readonly #control: string;
  readonly #user: Role;
  #vanMoved: boolean | null = null;
  #watered: boolean | null = null;

  constructor(van: LatLon, aidStation: LatLon, control: string, user: Role) {
    this.#van = new CallOut(van, { people: 1, seconds: 30 });
    this.#water = new CallOut(aidStation, { people: 1, kit: 'water', seconds: 20 });
    this.#control = control;
    this.#user = user;
  }

  get tally(): MishapsTally {
    return { vanMoved: this.#vanMoved, watered: this.#watered };
  }

  tick(stage: Stage): void {
    if (stage.elapsed >= VAN_S && this.#vanMoved === null) this.#vanOnCourse(stage);
    if (stage.elapsed >= WATER_S && this.#watered === null) this.#outOfWater(stage);
  }

  #vanOnCourse(stage: Stage): void {
    const { at } = this.#van;
    const where = stage.ground.where(stage.t, at, landmarkOf(stage));
    if (stage.once('van')) {
      stage.act(this.#control, {
        type: 'marker',
        id: VAN,
        symbol: SymbolCode.HAZARD,
        label: stage.t('practiceRaceVanLabel'),
        where: at,
      });
      stage.say(this.#control, stage.t('practiceRaceVan', { where }));
      this.#send(
        stage,
        { id: 'van', text: stage.t('practiceRaceMoveVan', { where }), marker: VAN, at },
        (who) => !who.coordinates,
      );
      return;
    }
    const [mover] = this.#van.tick(stage) ?? [];
    if (mover !== undefined) {
      this.#vanMoved = true;
      stage.say(mover.alias, stage.t('practiceRaceVanMoved'));
      stage.act(mover.alias, {
        type: 'marker',
        id: VAN,
        symbol: SymbolCode.GENERIC,
        label: stage.t('practiceRaceVanGone'),
        where: at,
      });
      return;
    }
    if (stage.elapsed - VAN_S < VAN_WAITS_S) return;
    this.#vanMoved = false;
    stage.say(this.#control, stage.t('practiceRaceVanHurt', { where }));
  }

  #outOfWater(stage: Stage): void {
    if (stage.once('no water')) {
      stage.say(this.#control, stage.t('practiceRaceNoWater'));
      const task = { id: 'water', text: stage.t('practiceRaceBringWater'), marker: AID_STATION };
      this.#send(stage, { ...task, at: this.#water.at }, (who) => who.has('water'));
      return;
    }
    const [carrier] = this.#water.tick(stage) ?? [];
    if (carrier !== undefined) {
      this.#watered = true;
      stage.say(carrier.alias, stage.t('practiceRaceWaterBrought'));
      return;
    }
    if (stage.elapsed - WATER_S < WATER_WAITS_S) return;
    this.#watered = false;
    stage.say(this.#control, stage.t('practiceRaceNoWaterLate'));
  }

  /** When the user is a member, Carmen gives the task to whoever is nearest and fit for it. */
  #send(stage: Stage, task: MishapTask, fit: (who: Teammate) => boolean): void {
    if (this.#user !== 'member') return;
    stage.after(20, () => {
      const who = stage.crew.nearest(task.at, fit);
      stage.act(CARMEN, {
        type: 'task',
        id: task.id,
        text: task.text,
        assignee: who?.alias ?? null,
        place: { kind: 'object', id: task.marker },
      });
    });
  }
}
