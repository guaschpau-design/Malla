// What wears the teammates out. Their phones run down, each at its own pace: they tell the team
// each time the battery drops past a ten (as the app tells it, protocol §3.14), say when they start
// saving it, and when it is about to go. Someone who tires asks for a break between two jobs and
// takes it, resting for a few minutes, then carries on.

import type { Stage } from '../exercise.ts';
import type { Teammate } from '../teammate.ts';

/** How long a break lasts. */
const BREAK_MINUTES = 3;

export class BodyRoutine {
  /** When each teammate was last looked at, in milliseconds. */
  readonly #lastMs = new Map<Teammate, number>();
  /** Milliseconds each teammate has spent busy since their last break. */
  readonly #busyMs = new Map<Teammate, number>();

  tick(stage: Stage): void {
    for (const teammate of stage.crew.onTheGround) {
      const last = this.#lastMs.get(teammate) ?? stage.now;
      this.#lastMs.set(teammate, stage.now);
      const passed = stage.now - last;
      this.#drain(stage, teammate, passed / 60_000);
      if (teammate.job !== null) {
        this.#busyMs.set(teammate, (this.#busyMs.get(teammate) ?? 0) + passed);
      }
      this.#tire(stage, teammate);
    }
  }

  #drain(stage: Stage, teammate: Teammate, minutes: number): void {
    const before = phoneOf(teammate);
    if (before.silent) return;
    teammate.drain(minutes);
    const after = phoneOf(teammate);
    if (Math.floor(after.battery / 10) < Math.floor(before.battery / 10) || after.silent) {
      tell(stage, teammate);
    }
    if (!before.saving && after.saving) {
      stage.say(teammate.alias, stage.line('lowBattery', { percent: after.battery }));
    }
    if (after.silent) stage.say(teammate.alias, stage.line('flatBattery'));
  }

  #tire(stage: Stage, teammate: Teammate): void {
    const tires = teammate.persona?.tires;
    if (tires === undefined || teammate.job !== null || teammate.status !== 'active') return;
    if ((this.#busyMs.get(teammate) ?? 0) < tires * 60_000) return;
    this.#busyMs.set(teammate, 0);
    teammate.rest('resting');
    tell(stage, teammate);
    stage.say(teammate.alias, stage.line('break', { minutes: BREAK_MINUTES }));
    stage.after(BREAK_MINUTES * 60, () => {
      teammate.rest('active');
      tell(stage, teammate);
      stage.say(teammate.alias, stage.line('backFromBreak'));
    });
  }
}

/** How a teammate's phone is doing now. */
function phoneOf(teammate: Teammate): { battery: number; saving: boolean; silent: boolean } {
  return { battery: teammate.battery, saving: teammate.saving, silent: teammate.silent };
}

/** A teammate tells the team how they are now: status, battery and what they carry. */
function tell(stage: Stage, teammate: Teammate): void {
  const { persona } = teammate;
  if (persona === null) return;
  stage.act(teammate.alias, {
    type: 'state',
    profile: persona.profile,
    status: teammate.status,
    battery: teammate.battery,
    equipment: persona.equipment,
  });
}
