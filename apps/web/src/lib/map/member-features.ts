// Members' latest positions as GeoJSON for the map.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import type { Feature, FeatureCollection, Point } from 'geojson';

/** A position older than this is drawn as stale. */
export const STALE_AFTER_S = 10 * 60;

export interface MemberProperties {
  readonly label: string;
  readonly self: boolean;
  readonly stale: boolean;
}

export type MemberCollection = FeatureCollection<Point, MemberProperties>;

export function memberFeatures(state: GroupState, self: NodeId, now: number): MemberCollection {
  const features: Feature<Point, MemberProperties>[] = [];
  for (const [origin, report] of state.positions) {
    if (report.type !== 'position') continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [report.lon, report.lat] },
      properties: {
        label: state.members.get(origin)?.alias ?? origin,
        self: origin === self,
        stale: now - report.time > STALE_AFTER_S,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
