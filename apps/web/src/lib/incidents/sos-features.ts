// The SOS calls still open, as GeoJSON for the map: each where its caller is (incidents.ts).

import type { GroupState } from '@tesel/core';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { toPosition } from '../map/geometry.ts';
import { aliasOf, whereSos } from './incidents.ts';

export interface SosProperties {
  /** The call's reference key. */
  readonly key: string;
  /** Who called, by alias. */
  readonly label: string;
}

/**
 * The open calls with a known place. The members are read only for the open calls, and the
 * positions only for those made without a place of their own (SosLayer.svelte relies on it).
 */
export function sosFeatures(
  state: Pick<GroupState, 'sos' | 'sosCancels' | 'members' | 'positions'>,
): FeatureCollection<Point, SosProperties> {
  const features: Feature<Point, SosProperties>[] = [];
  for (const [key, call] of state.sos) {
    if (state.sosCancels.has(key)) continue;
    const where = whereSos(state, call);
    if (where.kind === 'unknown') continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(where.at) },
      properties: { key, label: aliasOf(state, call.origin) },
    });
  }
  return { type: 'FeatureCollection', features };
}
