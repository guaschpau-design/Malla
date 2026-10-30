// How the search for Rosa went, for the report at the end (debrief.ts): who found her and when,
// how the neighbour who fell fared, and, when the user coordinated, whether they planned a sweep.

import type { Findings, Note } from '../debrief/findings.ts';
import type { Stage } from '../exercise.ts';
import { clockTime } from '../clock-time.ts';
import type { MissingPersonWorld } from './missing-person-world.ts';

export function missingPersonFindings(world: MissingPersonWorld): (stage: Stage) => Findings {
  return (stage) => {
    const { t } = stage;
    const { finding } = world;
    const notes: Note[] = [];
    const rosa =
      finding === null
        ? t('debriefRosaLost')
        : t(finding.byDogs ? 'debriefRosaDogs' : 'debriefRosaTeam', {
            time: clockTime(finding.elapsed),
          });
    notes.push(
      finding !== null && !finding.byDogs
        ? { good: true, text: t('debriefRosaFoundNote') }
        : { good: false, text: t('debriefRosaDogsNote') },
    );
    const neighbour = world.neighbour(stage.elapsed);
    const fared = {
      helped: 'debriefNeighbourHelped',
      ambulance: 'debriefNeighbourAmbulance',
      waiting: 'debriefNeighbourWaiting',
    } as const;
    if (neighbour === 'helped') notes.push({ good: true, text: t('debriefNeighbourHelpedNote') });
    if (neighbour === 'ambulance')
      notes.push({ good: false, text: t('debriefNeighbourAloneNote') });
    if (stage.user.role === 'coordinator' && !sweptByUser(stage)) {
      notes.push({ good: false, text: t('debriefNoSweep') });
    }
    return {
      figures: [
        { label: t('debriefRosa'), value: rosa },
        ...(neighbour === null
          ? []
          : [{ label: t('debriefNeighbour'), value: t(fared[neighbour]) }]),
      ],
      notes,
    };
  };
}

/** Whether the user planned the sweep of a search area. */
function sweptByUser(stage: Stage): boolean {
  return [...stage.state.objects.values()].some(
    (record) => record.type === 'sweep' && record.object.origin === stage.user.node,
  );
}
