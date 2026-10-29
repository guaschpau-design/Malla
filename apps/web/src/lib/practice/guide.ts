// The practice's guide: five things to do, shown one at a time on the practice's card, each ticked
// off as soon as the user has done it, in any order. A member learns to see a teammate, talk, do a
// task, answer an SOS and report; a coordinator, to form a team, hand out a task, talk, answer an
// SOS and plan a sweep, or, with no area to search, turn on the check-in (ADR-0066).

import type { GroupState } from '@tesel/core';
import type { NodeId, Role } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';

/** What the user has done that the group's state does not keep. */
interface Seen {
  /** A teammate's card was opened, from the map or the list. */
  readonly teammate: boolean;
}

export interface GuideStep {
  readonly text: MessageKey;
  readonly done: (state: GroupState, self: NodeId, seen: Seen) => boolean;
}

const own = <T extends { readonly origin: NodeId }>(events: Iterable<T>, self: NodeId) =>
  [...events].some((event) => event.origin === self);

const SEE_TEAMMATE: GuideStep = { text: 'guideSeeTeammate', done: (_, __, seen) => seen.teammate };

const TALK: GuideStep = { text: 'guideTalk', done: (state, self) => own(state.chat, self) };

/** A task someone gave the user, or the user's team, done by the user. */
const DO_TASK: GuideStep = {
  text: 'guideDoTask',
  done: (state, self) =>
    [...state.tasks.values()].some(
      (task) => task.status === 'done' && task.origin === self && task.task.origin !== self,
    ),
};

/** An SOS of a teammate's, acknowledged by the user. */
const ANSWER_SOS: GuideStep = {
  text: 'guideAnswerSos',
  done: (state, self) =>
    [...state.sos].some(([key, sos]) => sos.origin !== self && state.acks.get(key)?.has(self)),
};

const REPORT: GuideStep = { text: 'guideReport', done: (state, self) => own(state.reports, self) };

const FORM_TEAM: GuideStep = {
  text: 'guideFormTeam',
  done: (state, self) => own(state.teams.values(), self),
};

/** A task the user gave a teammate or a team. */
const GIVE_TASK: GuideStep = {
  text: 'guideGiveTask',
  done: (state, self) =>
    [...state.tasks.values()].some(
      (task) => task.task.origin === self && task.assignee !== null && task.assignee !== self,
    ),
};

const PLAN_SWEEP: GuideStep = {
  text: 'guidePlanSweep',
  done: (state, self) =>
    [...state.objects.values()].some((object) => object.type === 'sweep' && object.origin === self),
};

const TURN_ON_CHECK_IN: GuideStep = {
  text: 'guideCheckIn',
  done: (state, self) => state.checkIn?.origin === self && state.checkIn.minutes > 0,
};

/** The guide for the user's part, in the order its steps are shown. */
export function guideSteps(user: Role, search: boolean): readonly GuideStep[] {
  return user === 'member'
    ? [SEE_TEAMMATE, TALK, DO_TASK, ANSWER_SOS, REPORT]
    : [FORM_TEAM, GIVE_TASK, TALK, ANSWER_SOS, search ? PLAN_SWEEP : TURN_ON_CHECK_IN];
}
