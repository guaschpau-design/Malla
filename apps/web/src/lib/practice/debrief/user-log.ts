// When the user did what the report at the end weighs (debrief.ts): how long each SOS of a teammate
// waited for the user's acknowledgement, and when the user, as coordinator, first gave the team
// something to do. The group's state says what was done, not when, so the log looks at it as the
// exercise goes, once a second and whenever it changes.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';

import { aliasOf } from '../../members/alias.ts';

/** A teammate's SOS: who called it, and when it came and was answered, in seconds into the exercise. */
export interface SosCall {
  readonly who: string;
  readonly came: number;
  answered: number | null;
}

export class UserLog {
  /** The teammates' SOS calls, by their key. */
  readonly #calls = new Map<string, SosCall>();
  /** When the user first formed a team or gave a task, in seconds into the exercise. */
  #firstOrder: number | null = null;

  get calls(): readonly SosCall[] {
    return [...this.#calls.values()];
  }

  get firstOrder(): number | null {
    return this.#firstOrder;
  }

  /** Notes what the user has done by `elapsed` seconds, as `state` shows it. */
  look(state: GroupState, user: NodeId, elapsed: number): void {
    for (const [key, sos] of state.sos) {
      if (sos.origin === user) continue;
      const call = this.#calls.get(key) ?? {
        who: aliasOf(state, sos.origin),
        came: elapsed,
        answered: null,
      };
      this.#calls.set(key, call);
      if (call.answered === null && state.acks.get(key)?.has(user)) call.answered = elapsed;
    }
    if (this.#firstOrder !== null) return;
    const ordered =
      [...state.tasks.values()].some((task) => task.task.origin === user) ||
      [...state.teams.values()].some((team) => team.origin === user);
    if (ordered) this.#firstOrder = elapsed;
  }
}
