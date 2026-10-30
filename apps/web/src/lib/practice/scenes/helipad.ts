// Where the helicopter of a wildfire lands (wildfire.ts): fifteen minutes in it asks for somewhere
// clear, and waits a few minutes for someone to mark it on the map before landing far away.

import { SymbolCode } from '@tesel/protocol';

import type { Stage } from '../exercise.ts';

/** When the helicopter asks for somewhere to land, and how long it can wait. */
export const HELIPAD_S = 960;
export const HELIPAD_WAITS_S = 240;

/** When someone marked where the helicopter can land, in seconds into the exercise; null if nobody has. */
export function helipadMarkedAt(stage: Stage): number | null {
  const start = stage.now / 1000 - stage.elapsed;
  const marked = [...stage.state.objects.values()].flatMap((record) =>
    record.type === 'marker' && record.symbol === SymbolCode.HELICOPTER
      ? [record.time - start]
      : [],
  );
  return marked.length === 0 ? null : Math.min(...marked);
}
