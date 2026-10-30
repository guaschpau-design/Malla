// How the wildfire went, for the report at the end (debrief.ts): the houses emptied before the
// fire came, the families it trapped and who got them out, the helicopter's landing place, and the
// teammates it caught.

import type { Findings, Note } from '../debrief/findings.ts';
import type { Stage } from '../exercise.ts';
import { HELIPAD_S, HELIPAD_WAITS_S, helipadMarkedAt } from './helipad.ts';
import type { WildfireWorld } from './wildfire-world.ts';

export function wildfireFindings(world: WildfireWorld): (stage: Stage) => Findings {
  return (stage) => {
    const { t } = stage;
    const { emptied, trapped, rescued, firefighters, houses } = world.tally;
    const { caught } = world;
    const marked = helipadMarkedAt(stage);
    const helipad =
      marked === null
        ? 'debriefHelipadNone'
        : marked <= HELIPAD_S + HELIPAD_WAITS_S
          ? 'debriefHelipadInTime'
          : 'debriefHelipadLate';
    const notes: Note[] = [];
    if (emptied === houses) notes.push({ good: true, text: t('debriefHousesAllEmptied') });
    if (trapped > 0)
      notes.push({ good: false, text: t('debriefHousesReached', { count: trapped }) });
    if (stage.elapsed >= HELIPAD_S) {
      notes.push(
        helipad === 'debriefHelipadInTime'
          ? { good: true, text: t('debriefHelipadInTimeNote') }
          : { good: false, text: t('debriefHelipadLateNote') },
      );
    }
    if (caught > 0) notes.push({ good: false, text: t('debriefFireCaught', { count: caught }) });
    return {
      figures: [
        {
          label: t('debriefHousesEmptied'),
          value: t('debriefOf', { count: emptied, total: houses }),
        },
        ...(trapped > 0
          ? [
              {
                label: t('debriefHousesTrapped'),
                value: t('debriefFireRescues', { trapped, rescued, firefighters }),
              },
            ]
          : []),
        ...(stage.elapsed >= HELIPAD_S ? [{ label: t('debriefHelipad'), value: t(helipad) }] : []),
        ...(caught > 0 ? [{ label: t('debriefTeammatesCaught'), value: String(caught) }] : []),
      ],
      notes,
    };
  };
}
