// Editing a task, wherever the editing starts: the tasks panel itself, a point or an object of the
// map ("Task here"), or a task tapped on the map. The tasks panel carries what it edits
// (ui/panels.svelte.ts).

import type { TaskPlace } from '@tesel/protocol';

import { openPanel } from '../ui/panels.svelte.ts';

/** The tasks panel with its list. */
export const TASK_LIST = { name: 'tasks', editing: null } as const;

export function newTask(place: TaskPlace | null): void {
  openPanel({ name: 'tasks', editing: { kind: 'new', place } });
}

export function editTask(key: string): void {
  openPanel({ name: 'tasks', editing: { kind: 'existing', key } });
}

/** Back to the list. */
export function stopEditingTask(): void {
  openPanel(TASK_LIST);
}
