// Getting away from danger, as people do of their own accord: back to the meeting point, along the
// streets, and free again once there for whatever comes next.

import type { Stage } from '../exercise.ts';
import { landmarkOf } from '../landmark.ts';
import type { Teammate } from '../teammate.ts';

/** Sends `who` back to the meeting point, doing `what` on the way; false if they cannot get there. */
export function pullBack(stage: Stage, who: Teammate, what: string): boolean {
  const job = { kind: 'scene', what } as const;
  const back = stage.walk(who, job, { kind: 'along', points: [landmarkOf(stage).at] });
  if (back === null) return false;
  stage.after((back - stage.now) / 1000, () => {
    if (who.job === job) who.stop(stage.now);
  });
  return true;
}
