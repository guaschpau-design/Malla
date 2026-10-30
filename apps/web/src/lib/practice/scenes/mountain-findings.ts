// How the mountain outing went, for the report at the end (debrief.ts): when the group turned back
// and who decided, whether the storm caught anyone high up, how long Jordi was lost and how he was
// found, and how the one who slipped was rescued.

import { clockTime } from '../clock-time.ts';
import type { Figure, Findings, Note } from '../debrief/findings.ts';
import type { Stage } from '../exercise.ts';
import { THUNDER_S, type MountainWorld } from './mountain-world.ts';

/** Turning back within this many seconds of the first thunder is turning back in time. */
const TURN_IN_TIME_S = 180;

export function mountainFindings(world: MountainWorld): (stage: Stage) => Findings {
  return (stage) => {
    const { t } = stage;
    const { turnedAt, turnedBy, exposed, astray, rescue } = world.tally(stage);
    const figures: Figure[] = [];
    const notes: Note[] = [];
    figures.push({
      label: t('debriefMountainTurned'),
      value:
        turnedAt === null
          ? t('debriefMountainNotTurned')
          : turnedBy === 'storm'
            ? t('debriefMountainTurnedByStorm')
            : t('debriefAt', { time: clockTime(turnedAt) }),
    });
    if (turnedBy === 'user') {
      notes.push(
        turnedAt !== null && turnedAt <= THUNDER_S + TURN_IN_TIME_S
          ? { good: true, text: t('debriefMountainTurnedInTime') }
          : { good: false, text: t('debriefMountainTurnedLate') },
      );
    }
    if (turnedBy === 'storm' || turnedAt === null) {
      notes.push({ good: false, text: t('debriefMountainNeverTurned') });
    }
    if (exposed !== null) {
      figures.push({ label: t('debriefMountainExposed'), value: String(exposed) });
      if (exposed > 0)
        notes.push({ good: false, text: t('debriefMountainExposedNote', { count: exposed }) });
    }
    if (astray !== null) {
      const time = clockTime(astray.lostFor);
      const value = {
        found: 'debriefMountainJordiFound',
        alone: 'debriefMountainJordiAlone',
        still: 'debriefMountainJordiStill',
      } as const;
      figures.push({ label: t('debriefMountainJordi'), value: t(value[astray.ended], { time }) });
      notes.push(
        astray.ended === 'found'
          ? { good: true, text: t('debriefMountainJordiFoundNote') }
          : { good: false, text: t('debriefMountainJordiLostNote') },
      );
    }
    if (rescue !== null) {
      const called = rescue.calledAt === null ? null : clockTime(rescue.calledAt);
      const ended = {
        helicopter: 'debriefMountainByHelicopter',
        'on-foot': 'debriefMountainOnFoot',
        waiting: 'debriefMountainWaiting',
      } as const;
      figures.push({
        label: t('debriefMountainRescue'),
        value:
          called === null
            ? t('debriefMountainNoCall')
            : t('debriefMountainCalled', { time: called, ended: t(ended[rescue.ended]) }),
      });
      figures.push({
        label: t('debriefMountainLanding'),
        value: t(
          rescue.landingMarked ? 'debriefMountainLandingMarked' : 'debriefMountainLandingNone',
        ),
      });
      if (called === null) notes.push({ good: false, text: t('debriefMountainNoCallNote') });
      else if (!rescue.byUser) notes.push({ good: false, text: t('debriefMountainCarmenCalled') });
      if (rescue.ended === 'helicopter')
        notes.push({ good: true, text: t('debriefMountainLiftedNote') });
      if (rescue.ended === 'on-foot')
        notes.push({ good: false, text: t('debriefMountainOnFootNote') });
      if (!rescue.landingMarked) notes.push({ good: false, text: t('debriefMountainLandingNote') });
    }
    return { figures, notes };
  };
}
