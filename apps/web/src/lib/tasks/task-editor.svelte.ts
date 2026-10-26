// Which task the tasks panel is editing, wherever the editing starts: the panel itself, a point or
// an object of the map ("Task here"), or a task tapped on the map.

import type { LatLon } from '@tesel/protocol';

import { panels } from '../ui/panels.svelte.ts';

export type TaskEditing =
  /** A new task, at a place of the map or nowhere in particular. */
  | { readonly kind: 'new'; readonly place: LatLon | null }
  /** An existing task, by its reference's key. */
  | { readonly kind: 'existing'; readonly key: string };

export const taskEditor = $state({ editing: null as TaskEditing | null });

export function newTask(place: LatLon | null): void {
  taskEditor.editing = { kind: 'new', place };
  panels.open = 'tasks';
}

export function editTask(key: string): void {
  taskEditor.editing = { kind: 'existing', key };
  panels.open = 'tasks';
}

/** Back to the list. */
export function stopEditingTask(): void {
  taskEditor.editing = null;
}
