// Which side panel is open, with what it shows (ADR-0048). Only one is open at a time, wherever it
// is opened from; a panel about something carries that something, so it can never show another.

import type { LatLon, NodeId } from '@tesel/protocol';

import type { TaskEditing } from '../tasks/task-editor.svelte.ts';

/** Panels that show the same thing whenever they open. */
export type PlainPanelName =
  'offline' | 'groups' | 'chat' | 'connections' | 'layers' | 'me' | 'find' | 'diary';

export type Panel =
  | { readonly name: PlainPanelName }
  /** An object of the group, by its reference's key. */
  | { readonly name: 'object'; readonly key: string }
  | { readonly name: 'member'; readonly member: NodeId }
  /** A point of the map, and what to call it: a service's name, or "map point". */
  | { readonly name: 'point'; readonly at: LatLon; readonly title: string }
  /** The task list, or the task being edited. */
  | { readonly name: 'tasks'; readonly editing: TaskEditing | null };

export type PanelName = Panel['name'];

class Panels {
  open: Panel | null = $state.raw(null);
}

export const panels = new Panels();

export function isOpen(name: PanelName): boolean {
  return panels.open?.name === name;
}

export function openPanel(panel: Panel | PlainPanelName): void {
  panels.open = typeof panel === 'string' ? { name: panel } : panel;
}

/** Opens a panel, or closes it if it is the one open: what its button does. */
export function togglePanel(panel: Panel | PlainPanelName): void {
  const name = typeof panel === 'string' ? panel : panel.name;
  if (isOpen(name)) closePanel();
  else openPanel(panel);
}

export function closePanel(): void {
  panels.open = null;
}
