// Which side panel is open. Only one is open at a time, wherever it is opened from.

export type PanelName =
  'offline' | 'groups' | 'chat' | 'object' | 'member' | 'connections' | 'point';

export const panels = $state({ open: null as PanelName | null });

export function togglePanel(name: PanelName): void {
  panels.open = panels.open === name ? null : name;
}

export function closePanel(): void {
  panels.open = null;
}
