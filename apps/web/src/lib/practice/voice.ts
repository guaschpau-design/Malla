// How the simulated members say things: each thing in a few ways, one picked at random each time,
// so that the chat reads as people talking and not as a machine repeating itself.

import type { PluralKey } from '../i18n/en.ts';
import type { MessageKey, Translate } from '../i18n/index.ts';
import type { Chance } from './chance.ts';

/** The ways of saying each thing, by what it is. */
const SAYINGS = {
  heard: ['practiceHeard', 'practiceHeard2', 'practiceHeard3'],
  reportHeard: ['practiceReportHeard', 'practiceReportHeard2'],
  onTheWay: ['practiceOnTheWay', 'practiceOnTheWay2'],
  goingTo: ['practiceGoingTo', 'practiceGoingTo2', 'practiceGoingTo3'],
  attended: ['practiceSosAttended', 'practiceSosAttended2'],
  taken: ['practiceTaken', 'practiceTaken2', 'practiceTaken3'],
  done: ['practiceTaskDone', 'practiceTaskDone2', 'practiceTaskDone3'],
  noWay: ['practiceNoWay', 'practiceNoWay2'],
  noWayTo: ['practiceNoWayTo'],
  thanks: ['practiceThanks', 'practiceThanks2'],
  idle: ['practiceIdle', 'practiceIdle2'],
  where: ['practiceWhereAnswer', 'practiceWhereAnswer2'],
  doing: ['practiceDoing', 'practiceDoing2'],
  helping: ['practiceHelping'],
  free: ['practiceFree', 'practiceFree2'],
  sosNudge: ['practiceSosNudge'],
  lowBattery: ['practiceLowBattery'],
  flatBattery: ['practiceFlatBattery'],
  break: ['practiceBreak'],
  backFromBreak: ['practiceBackFromBreak', 'practiceBackFromBreak2'],
  raceHeadPasses: ['practiceRaceHeadPasses', 'practiceRaceHeadPasses2'],
} as const satisfies Record<string, readonly Exclude<MessageKey, PluralKey>[]>;

export type Saying = keyof typeof SAYINGS;

type Values = Readonly<Record<string, string | number>>;

/** One way of saying something, picked at random, with its `{placeholders}` filled. */
export function say(t: Translate, chance: Chance, saying: Saying, values: Values = {}): string {
  const ways: readonly Exclude<MessageKey, PluralKey>[] = SAYINGS[saying];
  const key = chance.pick(ways) ?? ways[0];
  return key === undefined ? '' : t(key, values);
}
