// The report at the end of an exercise (ADR-0073): figures of what happened, and a few plain words
// on what went well and what to do better. The situation tells its own part (Findings): whether
// the person was found, how many homes were warned. The rest is the same in every situation and
// depends on the user's part: how quickly they answered the teammates' SOS calls (user-log.ts has
// the times); as a member, whether they did the tasks given to them and sent reports; as the
// coordinator, how soon they set the team to work, and with what; and, where the network failed,
// whether their orders reached anyone.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';

import { clockTime } from '../clock-time.ts';
import type { Stage } from '../exercise.ts';
import type { CoverageTally } from '../coverage.ts';
import type { Figure, Findings, Note } from './findings.ts';
import type { UserLog } from './user-log.ts';

export interface Debrief {
  readonly figures: readonly Figure[];
  readonly good: readonly string[];
  readonly better: readonly string[];
}

/** An SOS answered within this many seconds is answered straight away. */
const SOS_QUICK_S = 60;
/** A coordinator who gives the first order within this many seconds sets the team to work soon. */
const ORDER_SOON_S = 180;
/** The most words of each kind: a report read at a glance. */
const MOST_GOOD = 3;
const MOST_BETTER = 4;

/** What the report reads of the exercise: the group as it ended, and the user's part in it. */
type Ending = Pick<Stage, 't' | 'state' | 'user' | 'elapsed'>;

/** The report of an exercise as it ends, the situation's findings first. */
export function debriefOf(
  stage: Ending,
  log: UserLog,
  findings: Findings,
  coverage: CoverageTally,
): Debrief {
  const { t, state, user } = stage;
  const part = user.role === 'member' ? asMember(stage) : asCoordinator(stage, log);
  const sos = answering(stage, log);
  const network = withoutCoverage(stage, coverage);
  const said = state.chat.filter((message) => message.origin === user.node).length;
  const figures = [
    { label: t('debriefLength'), value: clockTime(stage.elapsed) },
    ...findings.figures,
    ...network.figures,
    ...sos.figures,
    ...part.figures,
    { label: t('debriefMessages'), value: String(said) },
  ];
  const notes = [
    ...findings.notes,
    ...network.notes,
    ...sos.notes,
    ...part.notes,
    ...(said === 0 ? [{ good: false, text: t('debriefSilent') }] : []),
  ];
  return {
    figures,
    good: notes
      .filter((note) => note.good)
      .map((note) => note.text)
      .slice(0, MOST_GOOD),
    better: notes
      .filter((note) => !note.good)
      .map((note) => note.text)
      .slice(0, MOST_BETTER),
  };
}

/**
 * How the teammates fared without coverage, and whether the user's orders reached them: given to
 * someone cut off, an order waits until they have coverage again.
 */
function withoutCoverage(stage: Ending, coverage: CoverageTally): Findings {
  const { t } = stage;
  const { cut, longestS, stranded, strandedWaitS, reached } = coverage;
  const figures: Figure[] = [];
  const notes: Note[] = [];
  if (cut > 0) {
    figures.push({
      label: t('debriefCutOff'),
      value: t('debriefCutOffValue', { count: cut, time: clockTime(longestS) }),
    });
  }
  if (stranded > 0) {
    figures.push({
      label: t('debriefStranded'),
      value: t('debriefStrandedValue', { count: stranded, time: clockTime(strandedWaitS) }),
    });
    notes.push({ good: false, text: t('debriefStrandedNote', { count: stranded }) });
  } else if (reached > 0) {
    notes.push({ good: true, text: t('debriefReachedNote') });
  }
  return { figures, notes };
}

/** How the user answered the teammates' SOS calls, leaving out one too recent to weigh. */
function answering(stage: Ending, log: UserLog): Findings {
  const calls = log.calls.filter(
    (call) => call.answered !== null || stage.elapsed - call.came >= SOS_QUICK_S,
  );
  if (calls.length === 0) return { figures: [], notes: [] };
  const waits = calls.flatMap((call) =>
    call.answered === null ? [] : [call.answered - call.came],
  );
  const seconds = Math.round(waits.reduce((sum, wait) => sum + wait, 0) / (waits.length || 1));
  const value =
    waits.length === 0
      ? stage.t('debriefOf', { count: 0, total: calls.length })
      : stage.t('debriefSosAverage', { count: waits.length, total: calls.length, seconds });
  const missed = calls.find((call) => call.answered === null);
  const note =
    missed !== undefined
      ? { good: false, text: stage.t('debriefSosMissed', { name: missed.who }) }
      : seconds > SOS_QUICK_S
        ? { good: false, text: stage.t('debriefSosSlow', { seconds }) }
        : { good: true, text: stage.t('debriefSosQuick') };
  return { figures: [{ label: stage.t('debriefSos'), value }], notes: [note] };
}

/** What a member did with the tasks given to them, and whether they told what they saw. */
function asMember(stage: Ending): Findings {
  const { t, state, user } = stage;
  const given = [...state.tasks.values()].filter(
    (task) =>
      task.assignee === user.node && task.task.origin !== user.node && task.status !== 'cancelled',
  );
  const done = given.filter((task) => task.status === 'done');
  const left = given.find((task) => task.status !== 'done');
  const reports = state.reports.filter((report) => report.origin === user.node).length;
  const notes: Note[] = [];
  if (left !== undefined)
    notes.push({ good: false, text: t('debriefTaskLeft', { task: left.text }) });
  else if (done.length > 0) notes.push({ good: true, text: t('debriefTasksDone') });
  notes.push(
    reports > 0
      ? { good: true, text: t('debriefReported') }
      : { good: false, text: t('debriefNoReport') },
  );
  return {
    figures: [
      ...(given.length > 0
        ? [
            {
              label: t('debriefYourTasks'),
              value: t('debriefOf', { count: done.length, total: given.length }),
            },
          ]
        : []),
      { label: t('debriefReports'), value: String(reports) },
    ],
    notes,
  };
}

/** How soon a coordinator set the team to work, and with what. */
function asCoordinator(stage: Ending, log: UserLog): Findings {
  const { t, state, user } = stage;
  const { firstOrder } = log;
  const tasks = [...state.tasks.values()].filter((task) => task.task.origin === user.node).length;
  const teams = [...state.teams.values()].filter((team) => team.origin === user.node).length;
  const notes: Note[] = [];
  if (firstOrder === null) notes.push({ good: false, text: t('debriefNoOrders') });
  else if (firstOrder > ORDER_SOON_S)
    notes.push({ good: false, text: t('debriefOrderedLate', { time: clockTime(firstOrder) }) });
  else notes.push({ good: true, text: t('debriefOrderedSoon', { time: clockTime(firstOrder) }) });
  if (firstOrder !== null && teams === 0) notes.push({ good: false, text: t('debriefNoTeams') });
  return {
    figures: [
      {
        label: t('debriefFirstOrder'),
        value: firstOrder === null ? t('debriefNone') : clockTime(firstOrder),
      },
      { label: t('debriefTeams'), value: String(teams) },
      { label: t('debriefTasksGiven'), value: String(tasks) },
      { label: t('debriefOnMap'), value: String(drawnBy(state, user.node)) },
    ],
    notes,
  };
}

/** How many markers, shapes and sweeps someone put on the map and left there. */
function drawnBy(state: GroupState, node: NodeId): number {
  return [...state.objects.values()].filter(
    (record) => record.type !== 'object-delete' && record.object.origin === node,
  ).length;
}
