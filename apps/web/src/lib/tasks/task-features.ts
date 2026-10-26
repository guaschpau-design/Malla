// Pending tasks that have a place, as GeoJSON for the map.

import type { GroupState } from '@tesel/core';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { isPending } from './tasks.ts';

/** Longer texts are cut on the map; the whole text is in the tasks panel. */
const LABEL_LENGTH = 28;

export interface TaskProperties {
  /** The task reference's key, used to open the task. */
  readonly key: string;
  readonly label: string;
  readonly started: boolean;
}

export function taskFeatures(state: GroupState): FeatureCollection<Point, TaskProperties> {
  const features: Feature<Point, TaskProperties>[] = [];
  for (const [key, task] of state.tasks) {
    if (task.place === null || !isPending(task.status)) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [task.place.lon, task.place.lat] },
      properties: { key, label: shorten(task.text), started: task.status === 'in-progress' },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Cuts between characters as people see them, so an emoji or an accent is never split. */
function shorten(text: string): string {
  const characters = Array.from(new Intl.Segmenter().segment(text), (part) => part.segment);
  if (characters.length <= LABEL_LENGTH) return text;
  return `${characters.slice(0, LABEL_LENGTH - 1).join('')}…`;
}
