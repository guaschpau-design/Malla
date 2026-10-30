// The place everyone in an exercise knows, which the members tell others from ("200 m north of
// the meeting point"): the meeting point marked on the map, or else where whoever leads stands.

import { SymbolCode } from '@tesel/protocol';

import type { Stage } from './exercise.ts';
import type { Landmark } from './ground.ts';

export function landmarkOf(stage: Stage): Landmark {
  for (const record of stage.state.objects.values()) {
    if (record.type === 'marker' && record.symbol === SymbolCode.MEETING_POINT) {
      return { at: { lat: record.lat, lon: record.lon }, name: record.label };
    }
  }
  return { at: stage.crew.lead.at(stage.now), name: stage.crew.lead.alias };
}
