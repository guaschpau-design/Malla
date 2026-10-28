// What is done with a sweep for the whole group: planned, one strip per team each handed out as a
// task, and removed, with what is left of its tasks.

import type { NodeId, ShapeEvent } from '@tesel/protocol';

import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { fieldsOf, isPending } from '../tasks/tasks.ts';
import { stripTasks } from './sweeps.ts';

export interface SweepRecipe {
  /** Metres between lanes. */
  readonly spacing: number;
  /** Direction of the lanes, degrees clockwise from true north, 0–179. */
  readonly heading: number;
}

/**
 * Sweeps `area` in one strip per team, each a task for the team's member (null for anyone)
 * whose text `name` gives.
 */
export async function planSweep(
  feed: GroupFeed,
  area: ShapeEvent,
  recipe: SweepRecipe,
  teams: readonly (NodeId | null)[],
  name: (strip: number) => string,
): Promise<void> {
  for (const [strip, assignee] of teams.entries()) {
    const object = await feed.addSweepStrip(area.object, recipe, strip, teams.length);
    await feed.writeTask(null, {
      status: 'open',
      assignee,
      place: { kind: 'object', object },
      text: name(strip),
    });
  }
}

/** Deletes the strips, by key, and cancels the tasks along them still to do. */
export async function removeSweep(feed: GroupFeed, strips: readonly string[]): Promise<void> {
  for (const key of strips) {
    for (const task of stripTasks(feed.state.tasks, key)) {
      if (isPending(task.status)) {
        await feed.writeTask(task.task, { ...fieldsOf(task), status: 'cancelled' });
      }
    }
    const strip = feed.state.objects.get(key);
    if (strip?.type === 'sweep') await feed.deleteObject(strip.object);
  }
}
