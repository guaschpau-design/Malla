// How the race went, for the report at the end (debrief.ts): the crossings guarded when the leaders
// came, the cars that got in among the runners, the runner whose heart stopped, the van on the
// course, the aid station's water, and whether the user told when the leaders passed their post.

import { clockTime } from '../clock-time.ts';
import type { Figure, Findings, Note } from '../debrief/findings.ts';
import type { Stage } from '../exercise.ts';
import type { RaceWorld } from './race-world.ts';

export function raceFindings(world: RaceWorld): (stage: Stage) => Findings {
  return (stage) => {
    const { t } = stage;
    const tally = world.tally;
    const { guarded, crossings, cars } = tally;
    const figures: Figure[] = [
      {
        label: t('debriefRaceCrossings'),
        value: t('debriefOf', { count: guarded, total: crossings }),
      },
      { label: t('debriefRaceCars'), value: String(cars) },
    ];
    const notes: Note[] = [];
    // What the user did first: it is what they can do better themselves.
    if (tally.userReported !== null) {
      notes.push(
        tally.userReported
          ? { good: true, text: t('debriefRaceReported') }
          : { good: false, text: t('debriefRaceNotReported') },
      );
    }
    if (guarded === crossings) notes.push({ good: true, text: t('debriefRaceAllGuarded') });
    else
      notes.push({ good: false, text: t('debriefRaceUnguarded', { count: crossings - guarded }) });
    if (cars > 0) notes.push({ good: false, text: t('debriefRaceCarsNote', { count: cars }) });
    if (tally.happened) {
      const cpr = tally.cpr === null ? t('debriefNotCame') : clockTime(tally.cpr);
      const shock = tally.shock === null ? t('debriefNotCame') : clockTime(tally.shock);
      figures.push({
        label: t('debriefRaceCollapse'),
        value: t('debriefRaceCollapseValue', { cpr, shock }),
      });
      notes.push(
        tally.revived
          ? { good: true, text: t('debriefRaceRevived') }
          : { good: false, text: t('debriefRaceNotRevived') },
      );
    }
    if (tally.vanMoved !== null) {
      figures.push({
        label: t('debriefRaceVan'),
        value: t(tally.vanMoved ? 'debriefRaceVanMoved' : 'debriefRaceVanHit'),
      });
      if (!tally.vanMoved) notes.push({ good: false, text: t('debriefRaceVanNote') });
    }
    if (tally.watered !== null) {
      figures.push({
        label: t('debriefRaceWater'),
        value: t(tally.watered ? 'debriefRaceWatered' : 'debriefRaceDry'),
      });
      if (!tally.watered) notes.push({ good: false, text: t('debriefRaceDryNote') });
    }
    return { figures, notes };
  };
}
