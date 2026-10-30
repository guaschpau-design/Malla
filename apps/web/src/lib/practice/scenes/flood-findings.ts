// How the flood went, for the report at the end (debrief.ts): the homes warned before the water
// came, the families it trapped and who got them out, the underpass, and the teammates it caught.

import type { Findings, Note } from '../debrief/findings.ts';
import type { Stage } from '../exercise.ts';
import type { FloodWorld } from './flood-world.ts';

export function floodFindings(world: FloodWorld): (stage: Stage) => Findings {
  return (stage) => {
    const { t } = stage;
    const { warned, trapped, rescued, boat, homes } = world.homes.tally;
    const underpass = world.underpassEnded;
    const { caught } = world;
    const notes: Note[] = [];
    if (warned === homes) notes.push({ good: true, text: t('debriefHomesAllWarned') });
    if (trapped > 0)
      notes.push({ good: false, text: t('debriefHomesReached', { count: trapped }) });
    if (underpass === 'closed') notes.push({ good: true, text: t('debriefUnderpassClosedNote') });
    if (underpass === 'car') notes.push({ good: false, text: t('debriefUnderpassCarNote') });
    if (caught > 0) notes.push({ good: false, text: t('debriefFloodCaught', { count: caught }) });
    return {
      figures: [
        { label: t('debriefHomesWarned'), value: t('debriefOf', { count: warned, total: homes }) },
        ...(trapped > 0
          ? [
              {
                label: t('debriefHomesTrapped'),
                value: t('debriefFloodRescues', { trapped, rescued, boat }),
              },
            ]
          : []),
        ...(underpass === null
          ? []
          : [
              {
                label: t('debriefUnderpass'),
                value: t(underpass === 'closed' ? 'debriefUnderpassClosed' : 'debriefUnderpassCar'),
              },
            ]),
        ...(caught > 0 ? [{ label: t('debriefTeammatesCaught'), value: String(caught) }] : []),
      ],
      notes,
    };
  };
}
