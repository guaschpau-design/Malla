// What the teammates do about an SOS, as people near each other would. The nearest one answers
// the user's and goes to them. A teammate's is answered by whoever is nearest, a few seconds later,
// who drops what they were doing and goes; once they have been with them a while, and the user has
// acknowledged it too, so that answering it is always there to practise, it ends and whoever
// called it is well again. If the user has not acknowledged a teammate's SOS after a while,
// someone asks them whether they have seen it.

import { openSosCalls } from '@tesel/core';
import type { EventRef, LatLon, SosEvent } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';
import type { Teammate } from '../teammate.ts';

/** How long the nearest teammate takes to answer the user's SOS. */
const ANSWER_USER_S = 8;
/** How long, at least and at most, the nearest teammate takes to answer a teammate's SOS. */
const ANSWER_TEAMMATE_S = [15, 35] as const;
/** How long a helper stays with whoever called an SOS before it can be over. */
const STAY_WITH_S = 30;
/** How long a teammate's SOS may wait for the user's acknowledgement before someone asks. */
const NUDGE_AFTER_S = 120;

export class SosRoutine {
  /** Teammates' SOS calls, by key, that a helper has stayed with long enough. */
  readonly #attended = new Map<string, { readonly helper: Teammate; readonly called: Teammate }>();

  tick(stage: Stage): void {
    this.#recover(stage);
    for (const [key, sos] of openSosCalls(stage.state)) {
      const at = { lat: sos.lat, lon: sos.lon };
      const called = stage.crew.byNode(sos.origin);
      if (called === undefined) this.#answerUser(stage, key, sos, at);
      else this.#answerTeammate(stage, key, sos, at, called);
    }
    this.#endAttended(stage);
  }

  /** Whoever called an SOS that has ended is well again. */
  #recover(stage: Stage): void {
    for (const teammate of stage.crew.all) {
      if (teammate.sos !== null && stage.state.sosCancels.has(teammate.sos)) {
        teammate.recover(stage.now);
      }
    }
  }

  #answerUser(stage: Stage, key: string, sos: EventRef, at: LatLon): void {
    if (!stage.once(`sos ${key}`)) return;
    stage.after(ANSWER_USER_S, () => {
      const helper = stage.crew.nearest(at, (who) => !who.silent);
      if (helper === undefined || stage.state.sosCancels.has(key)) return;
      stage.send(helper, ack(sos));
      stage.say(helper.alias, stage.line('onTheWay'));
      stage.walk(helper, { kind: 'help', sos: key }, { kind: 'along', points: [at] });
    });
  }

  #answerTeammate(stage: Stage, key: string, sos: SosEvent, at: LatLon, called: Teammate): void {
    if (stage.once(`sos ${key}`)) {
      stage.after(stage.chance.between(...ANSWER_TEAMMATE_S), () => {
        if (stage.state.sosCancels.has(key)) return;
        const helper = stage.crew.nearest(at, (who) => who !== called && !who.silent);
        if (helper === undefined) return;
        stage.send(helper, ack(sos));
        const job = { kind: 'help', sos: key } as const;
        const arrival = stage.walk(helper, job, { kind: 'along', points: [at] });
        if (arrival === null) {
          stage.say(helper.alias, stage.line('noWayTo', { name: called.alias }));
          return;
        }
        stage.say(helper.alias, stage.line('goingTo', { name: called.alias }));
        stage.after((arrival - stage.now) / 1000 + STAY_WITH_S, () => {
          if (helper.job === job) this.#attended.set(key, { helper, called });
        });
      });
    }
    const acknowledged = stage.state.acks.get(key)?.has(stage.user.node) === true;
    const waited = stage.now / 1000 - sos.time;
    if (!acknowledged && waited > NUDGE_AFTER_S && stage.once(`nudge ${key}`)) {
      const speaker = stage.crew.nearest(at, (who) => who !== called && !who.silent);
      if (speaker !== undefined) {
        const values = { user: stage.user.name, name: called.alias };
        stage.say(speaker.alias, stage.line('sosNudge', values));
      }
    }
  }

  /** A teammate's SOS that a helper has stayed with, and the user has acknowledged, ends. */
  #endAttended(stage: Stage): void {
    for (const [key, { helper, called }] of this.#attended) {
      const call = stage.state.sos.get(key);
      const over = call === undefined || stage.state.sosCancels.has(key);
      if (!over && stage.state.acks.get(key)?.has(stage.user.node) !== true) continue;
      this.#attended.delete(key);
      if (over) continue;
      stage.say(helper.alias, stage.line('attended', { name: called.alias }));
      stage.send(called, (header) => ({ ...header, type: 'sos-cancel', sos: call }));
    }
  }
}

/** An acknowledgement of an event. */
function ack({ origin, seq }: EventRef): Parameters<Stage['send']>[1] {
  return (header) => ({ ...header, type: 'ack', target: { origin, seq } });
}
