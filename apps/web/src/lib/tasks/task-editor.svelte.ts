// Editing a task, wherever the editing starts: the tasks panel itself, a point or an object of the
// map ("Task here"), or a task tapped on the map. The tasks panel carries what it edits
// (ui/panels.svelte.ts).

import type { LatLon } from '@tesel/protocol';

import { openPanel } from '../ui/panels.svelte.ts';

export type TaskEditing =
  /** A new task, at a place of the map or nowhere in particular. */
  | { readonly kind: 'new'; readonly place: LatLon | null }
  /** An existing task, by its reference's key. */
  | { readonly kind: 'existing'; readonly key: string };

/** The tasks panel with its list. */
export const TASK_LIST = { name: 'tasks', editing: null } as const;

export function newTask(place: LatLon | null): void {
  openPanel({ name: 'tasks', editing: { kind: 'new', place } });
}

export function editTask(key: string): void {
  openPanel({ name: 'tasks', editing: { kind: 'existing', key } });
}

/** Back to the list. */
export function stopEditingTask(): void {
  openPanel(TASK_LIST);
}
